import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../services/api_service.dart';
import '../services/pdf_service.dart';
import '../utils/app_theme.dart';

class CreateInvoiceScreen extends StatefulWidget {
  const CreateInvoiceScreen({super.key});

  @override
  State<CreateInvoiceScreen> createState() => _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends State<CreateInvoiceScreen> {
  final _apiService = ApiService();
  List<dynamic> _clients = [];
  List<dynamic> _products = [];

  String? _selectedClientId;
  String _invoiceNumber = 'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(9)}';
  DateTime _date = DateTime.now();
  double _discount = 0;
  double _paidAmount = 0;
  String _paymentMode = 'CASH';

  List<Map<String, dynamic>> _items = [
    {'product_id': '', 'product_name': '', 'quantity': 1.0, 'price': 0.0, 'gst_percent': 18.0}
  ];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final responses = await Future.wait([
        _apiService.get('/clients'),
        _apiService.get('/products'),
      ]);
      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        setState(() {
          _clients = json.decode(responses[0].body);
          _products = json.decode(responses[1].body);
        });
      }
    } catch (e) {
      print('Error fetching data: $e');
    }
  }

  void _updateItem(int index, String field, dynamic value) {
    setState(() {
      if (field == 'product_id') {
        final prod = _products.firstWhere((p) => p['id'].toString() == value.toString(), orElse: () => null);
        if (prod != null) {
          _items[index] = {
            'product_id': value,
            'product_name': prod['name'],
            'price': prod['price'].toDouble(),
            'gst_percent': prod['gst_percent'].toDouble(),
            'quantity': _items[index]['quantity'] ?? 1.0,
          };
        }
      } else {
        _items[index][field] = value;
      }
    });
  }

  Map<String, double> _calculate() {
    double subTotal = 0;
    double gstTotal = 0;
    for (var item in _items) {
      final p = (item['price'] as num?)?.toDouble() ?? 0.0;
      final q = (item['quantity'] as num?)?.toDouble() ?? 0.0;
      final g = (item['gst_percent'] as num?)?.toDouble() ?? 18.0;
      subTotal += p * q;
      gstTotal += (p * q * g) / 100;
    }
    final total = subTotal + gstTotal - _discount;
    return {'subTotal': subTotal, 'gstTotal': gstTotal, 'total': total};
  }

  bool _isSaving = false;

  Future<void> _handleSubmit() async {
    if (_selectedClientId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('SELECT CUSTOMER')));
      return;
    }

    setState(() => _isSaving = true);
    final totals = _calculate();
    final body = {
      'client_id': _selectedClientId!,
      'invoice_number': _invoiceNumber,
      'date': _date.toIso8601String().split('T')[0],
      'discount': _discount,
      'paid_amount': _paidAmount,
      'status': _paidAmount >= totals['total']! ? 'PAID' : 'UNPAID',
      'payment_mode': _paymentMode,
      'total_amount': totals['total'],
      'items': _items.map((i) => {
        'product_id': i['product_id'] != '' ? i['product_id'].toString() : null,
        'product_name': i['product_name'],
        'quantity': i['quantity'],
        'price': i['price'],
        'gst_percent': i['gst_percent'],
      }).toList(),
    };

    try {
      final response = await _apiService.post('/invoices', body);
      if (response.statusCode == 200) {
        final savedInvoice = json.decode(response.body);
        final invoiceId = savedInvoice['id'];
        
        // Auto-Generate PDF
        final pdfRes = await _apiService.get('/invoices/$invoiceId/pdf');
        if (pdfRes.statusCode == 200) {
          if (kIsWeb) {
            final content = base64Encode(pdfRes.bodyBytes);
            final url = 'data:application/pdf;base64,$content';
            final anchor = Uri.parse(url);
            if (await canLaunchUrl(anchor)) {
              await launchUrl(anchor);
            }
          } else {
            await PdfService.saveAndOpen(pdfRes.bodyBytes, 'INV_$_invoiceNumber.pdf');
          }
        }
        
        if (mounted) Navigator.pop(context, true);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ERROR SAVING INVOICE')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = _calculate();
    final currencyFormat = NumberFormat.currency(symbol: '₹', locale: 'en_IN', decimalDigits: 0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Create Invoice'),
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isSaving 
        ? const Center(child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Generating Invoice...', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            ],
          ))
        : SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionHeader('Customer Details'),
                const SizedBox(height: 12),
                _buildCustomerSection(),
                const SizedBox(height: 32),
                _buildSectionHeader('Bill Items'),
                const SizedBox(height: 12),
                _buildProductsSection(),
                const SizedBox(height: 32),
                _buildSectionHeader('Payment Summary'),
                const SizedBox(height: 12),
                _buildSummarySection(totals, currencyFormat),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: Container(
                    decoration: BoxDecoration(
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.3),
                          blurRadius: 15,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.description_rounded),
                          SizedBox(width: 12),
                          Text('Save & Generate PDF', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w900,
          color: AppColors.textMuted,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildCustomerSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              value: _selectedClientId,
              decoration: const InputDecoration(
                hintText: 'Select Customer',
                prefixIcon: Icon(Icons.person_rounded, size: 20),
              ),
              icon: const Icon(Icons.expand_more_rounded),
              items: _clients.map((c) => DropdownMenuItem(
                value: c['id'].toString(), 
                child: Text("${c['name']} (${c['mobile']})", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))
              )).toList(),
              onChanged: (val) => setState(() => _selectedClientId = val),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(height: 1, color: Color(0xFFF1F5F9)),
              ),
              itemBuilder: (context, index) {
                final item = _items[index];
                return Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 4,
                          child: DropdownButtonFormField<String>(
                            value: item['product_id'] == '' ? null : item['product_id'].toString(),
                            decoration: const InputDecoration(
                              hintText: 'Select Product',
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            icon: const Icon(Icons.expand_more_rounded, size: 18),
                            items: _products.map((p) => DropdownMenuItem(
                              value: p['id'].toString(), 
                              child: Text(p['name'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))
                            )).toList(),
                            onChanged: (val) => _updateItem(index, 'product_id', val),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: TextField(
                            decoration: const InputDecoration(
                              hintText: 'Qty',
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                            onChanged: (val) => _updateItem(index, 'quantity', double.tryParse(val) ?? 0),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () {
                            if (_items.length > 1) {
                              setState(() => _items.removeAt(index));
                            }
                          },
                          icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 22),
                          style: IconButton.styleFrom(backgroundColor: const Color(0xFFFEF2F2)),
                        ),
                      ],
                    ),
                    if (item['price'] > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 8, left: 4),
                        child: Row(
                          children: [
                            Text(
                              "Price: ₹${item['price']}",
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              "GST: ${item['gst_percent']}%",
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 20),
            Center(
              child: TextButton.icon(
                onPressed: () => setState(() => _items.add({'product_id': '', 'product_name': '', 'quantity': 1.0, 'price': 0.0, 'gst_percent': 18.0})),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Another Item', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  backgroundColor: const Color(0xFFEFF6FF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummarySection(Map<String, double> totals, NumberFormat currencyFormat) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('AMOUNT PAID', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.textMuted, letterSpacing: 0.5)),
                      const SizedBox(height: 8),
                      TextField(
                        decoration: const InputDecoration(
                          hintText: '0.00',
                          prefixText: '₹ ',
                        ),
                        keyboardType: TextInputType.number,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                        onChanged: (val) => setState(() => _paidAmount = double.tryParse(val) ?? 0),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('PAYMENT MODE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.textMuted, letterSpacing: 0.5)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: _paymentMode,
                        items: ['CASH', 'ONLINE', 'UPI'].map((m) => DropdownMenuItem(
                          value: m, 
                          child: Text(m, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))
                        )).toList(),
                        onChanged: (val) => setState(() => _paymentMode = val!),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                children: [
                  _buildSummaryRow('Subtotal', currencyFormat.format(totals['subTotal'])),
                  const SizedBox(height: 8),
                  _buildSummaryRow('GST Total', currencyFormat.format(totals['gstTotal'])),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('TOTAL BILL', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.text)),
                      Text(currencyFormat.format(totals['total']), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.primary)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Balance Due', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                  Text(
                    currencyFormat.format(totals['total']! - _paidAmount), 
                    style: TextStyle(
                      fontSize: 14, 
                      fontWeight: FontWeight.w800, 
                      color: (totals['total']! - _paidAmount) > 0 ? AppColors.error : AppColors.success
                    )
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.text)),
      ],
    );
  }
}
