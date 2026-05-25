import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';
import 'dart:convert';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _apiService = ApiService();
  List<dynamic> _clients = [];
  List<dynamic> _filteredClients = [];
  bool _isLoading = true;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchClients();
    _searchController.addListener(_filterClients);
  }

  Future<void> _fetchClients() async {
    setState(() => _isLoading = true);
    try {
      final response = await _apiService.get('/clients');
      if (response.statusCode == 200) {
        setState(() {
          _clients = json.decode(response.body);
          _filteredClients = _clients;
        });
      }
    } catch (e) {
      print('Error fetching clients: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _filterClients() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredClients = _clients.where((c) {
        return c['name'].toString().toLowerCase().contains(query);
      }).toList();
    });
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Customers'),
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
              child: Column(
                children: [
                  Container(
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
                      decoration: InputDecoration(
                        hintText: 'Search by customer name...',
                        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                        fillColor: Colors.white,
                        filled: true,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Expanded(
                    child: _filteredClients.isEmpty
                        ? _buildEmptyState()
                        : ListView.separated(
                            physics: const BouncingScrollPhysics(),
                            itemCount: _filteredClients.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final client = _filteredClients[index];
                              return _buildClientCard(client);
                            },
                          ),
                  ),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddClientDialog,
        backgroundColor: AppColors.primary,
        elevation: 4,
        icon: const Icon(Icons.person_add_rounded, color: Colors.white),
        label: const Text('Add Customer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  Widget _buildClientCard(dynamic client) {
    return Card(
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.person_rounded, color: AppColors.primary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client['name'],
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.phone_outlined, size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          client['mobile'],
                          style: const TextStyle(fontSize: 13, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFCBD5E1)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline_rounded, size: 64, color: AppColors.textMuted.withOpacity(0.3)),
          const SizedBox(height: 16),
          const Text(
            'No customers found',
            style: TextStyle(color: AppColors.textMuted, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          const Text(
            'Add your first customer to get started',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  void _showAddClientDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final mobileController = TextEditingController();
    final addressController = TextEditingController();
    final gstController = TextEditingController();

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: '',
      pageBuilder: (context, anim1, anim2) => Container(),
      transitionBuilder: (context, anim1, anim2, child) {
        return Transform.scale(
          scale: anim1.value,
          child: Opacity(
            opacity: anim1.value,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.person_add_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Text('New Customer', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Basic Information', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 12),
                    TextField(controller: nameController, decoration: const InputDecoration(hintText: 'Customer Name', prefixIcon: Icon(Icons.person_outline, size: 20))),
                    const SizedBox(height: 16),
                    TextField(controller: mobileController, decoration: const InputDecoration(hintText: 'Mobile Number', prefixIcon: Icon(Icons.phone_outlined, size: 20)), keyboardType: TextInputType.phone),
                    const SizedBox(height: 24),
                    const Text('Optional Details', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 12),
                    TextField(controller: emailController, decoration: const InputDecoration(hintText: 'Email Address', prefixIcon: Icon(Icons.mail_outline, size: 20)), keyboardType: TextInputType.emailAddress),
                    const SizedBox(height: 16),
                    TextField(controller: addressController, decoration: const InputDecoration(hintText: 'Full Address', prefixIcon: Icon(Icons.map_outlined, size: 20))),
                    const SizedBox(height: 16),
                    TextField(controller: gstController, decoration: const InputDecoration(hintText: 'GSTIN Number', prefixIcon: Icon(Icons.badge_outlined, size: 20))),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
                ElevatedButton(
                  onPressed: () async {
                    if (nameController.text.isEmpty || mobileController.text.isEmpty) return;
                    final body = {
                      'name': nameController.text,
                      'mobile': mobileController.text,
                      'email': emailController.text,
                      'address': addressController.text,
                      'gst_number': gstController.text,
                    };
                    final response = await _apiService.post('/clients', body);
                    if (response.statusCode == 200) {
                      if (mounted) Navigator.pop(context);
                      _fetchClients();
                    }
                  },
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
                  child: const Text('Save Customer'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
