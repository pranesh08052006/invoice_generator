import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/pdf_service.dart';
import '../utils/app_theme.dart';

class InvoicesScreen extends StatefulWidget {
  final UserModel user;
  const InvoicesScreen({super.key, required this.user});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> with SingleTickerProviderStateMixin {
  final _apiService = ApiService();
  List<dynamic> _invoices = [];
  bool _isLoading = true;
  String _searchTerm = '';
  late TabController _tabController;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchInvoices();
    _tabController = TabController(length: _getTabCount(), vsync: this);
    _tabController.addListener(() => setState(() {}));
  }

  int _getTabCount() {
    if (widget.user.role == UserRole.super_admin) return 4;
    if (widget.user.role == UserRole.admin) return 3;
    return 1;
  }

  Future<void> _fetchInvoices() async {
    setState(() => _isLoading = true);
    try {
      final response = await _apiService.get('/invoices');
      if (response.statusCode == 200) {
        setState(() {
          _invoices = json.decode(response.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleStatusUpdate(String id, String status) async {
    try {
      final response = await _apiService.patch('/invoices/$id/status', {'status': status});
      if (response.statusCode == 200) {
        _fetchInvoices();
      }
    } catch (e) {
      print('Error updating status: $e');
    }
  }

  Future<void> _handleDownload(String id, String number) async {
    try {
      final response = await _apiService.get('/invoices/$id/pdf');
      if (response.statusCode == 200) {
        if (kIsWeb) {
          final content = base64Encode(response.bodyBytes);
          final url = 'data:application/pdf;base64,$content';
          final anchor = Uri.parse(url);
          if (await canLaunchUrl(anchor)) {
            await launchUrl(anchor);
          }
        } else {
          await PdfService.saveAndOpen(response.bodyBytes, 'INV_$number.pdf');
        }
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to download PDF')));
      }
    } catch (e) {
      print('Error downloading invoice: $e');
    }
  }

  Future<void> _handleShare(String id, String number) async {
    try {
      final response = await _apiService.get('/invoices/$id/pdf');
      if (response.statusCode == 200) {
        if (kIsWeb) {
           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sharing not supported on Web. Use Download.')));
           return;
        }
        await PdfService.share(response.bodyBytes, 'INV_$number.pdf', 'Invoice #$number');
      }
    } catch (e) {
      print('Error sharing invoice: $e');
    }
  }

  List<dynamic> _getFilteredInvoices() {
    var list = _invoices.where((i) {
      final searchMatch = i['invoice_number'].toString().toLowerCase().contains(_searchTerm.toLowerCase()) ||
          (i['user_name'] ?? '').toString().toLowerCase().contains(_searchTerm.toLowerCase());
      
      if (!searchMatch) return false;

      final tabIndex = _tabController.index;
      if (widget.user.role == UserRole.user) return true;

      // Super Admin Tabs: 0=All, 1=My, 2=Admins, 3=Users
      if (widget.user.role == UserRole.super_admin) {
        if (tabIndex == 0) return true;
        if (tabIndex == 1) return i['user_id'] == widget.user.id;
        if (tabIndex == 2) return i['user_role'] == 'admin';
        if (tabIndex == 3) return i['user_role'] == 'user';
      }

      // Admin Tabs: 0=All, 1=My, 2=Users
      if (widget.user.role == UserRole.admin) {
        if (tabIndex == 0) return true;
        if (tabIndex == 1) return i['user_id'] == widget.user.id;
        if (tabIndex == 2) return i['user_role'] == 'user';
      }

      return true;
    }).toList();
    
    return list..sort((a, b) => b['id'].toString().compareTo(a['id'].toString()));
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _getFilteredInvoices();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Transactions'),
        surfaceTintColor: Colors.white,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(120),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Container(
                  decoration: BoxDecoration(
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchTerm = val),
                    decoration: InputDecoration(
                      hintText: 'Search invoice # or creator...',
                      prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                      fillColor: Colors.white,
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ),
              TabBar(
                controller: _tabController,
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textMuted,
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                dividerColor: Colors.transparent,
                tabs: _getTabs(),
              ),
            ],
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : filtered.isEmpty
              ? _buildEmptyState()
              : ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    return _buildInvoiceCard(filtered[index]);
                  },
                ),
      floatingActionButton: widget.user.role == UserRole.user
          ? FloatingActionButton.extended(
              onPressed: () async {
                final result = await Navigator.pushNamed(context, '/invoices/new');
                if (result == true) _fetchInvoices();
              },
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: const Text('New Invoice', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            )
          : null,
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.description_outlined, size: 64, color: AppColors.textMuted.withOpacity(0.3)),
          const SizedBox(height: 16),
          const Text(
            'No transactions found',
            style: TextStyle(color: AppColors.textMuted, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          const Text(
            'Start by creating a new invoice',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  List<Widget> _getTabs() {
    if (widget.user.role == UserRole.super_admin) {
      return const [Tab(text: 'All Activity'), Tab(text: 'My Invoices'), Tab(text: 'Managers'), Tab(text: 'Employees')];
    }
    if (widget.user.role == UserRole.admin) {
      return const [Tab(text: 'All Activity'), Tab(text: 'My Invoices'), Tab(text: 'Employees')];
    }
    return const [Tab(text: 'All Activity')];
  }

  Widget _buildInvoiceCard(dynamic inv) {
    final currencyFormat = NumberFormat.currency(symbol: '₹', locale: 'en_IN', decimalDigits: 0);
    final status = (inv['status'] ?? '').toString().toUpperCase();
    final isPaid = status == 'PAID';

    return Card(
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF64748B), size: 20),
                      ),
                      const SizedBox(width: 14),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('INV-${inv['invoice_number']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.text)),
                          const SizedBox(height: 2),
                          Text(DateFormat('dd MMM, yyyy').format(DateTime.parse(inv['date'])), style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () => _handleStatusUpdate(inv['id'].toString(), isPaid ? 'UNPAID' : 'PAID'),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFDC2626), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                      ),
                    ),
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(height: 1, color: Color(0xFFF1F5F9)),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('GENERATED BY', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                        const SizedBox(height: 4),
                        Text(inv['user_name'] ?? 'System', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('TOTAL AMOUNT', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                      const SizedBox(height: 4),
                      Text(currencyFormat.format(inv['total_amount']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.primary, letterSpacing: -0.5)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  _buildActionButton(
                    icon: Icons.file_download_outlined,
                    label: 'PDF',
                    onTap: () => _handleDownload(inv['id'], inv['invoice_number']),
                  ),
                  const SizedBox(width: 8),
                  _buildActionButton(
                    icon: Icons.share_rounded,
                    label: 'Share',
                    onTap: () => _handleShare(inv['id'], inv['invoice_number']),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton({required IconData icon, required String label, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFF1F5F9)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF64748B)),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: Color(0xFF475569), fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
