import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  final UserModel user;
  const DashboardScreen({super.key, required this.user});

  @override
  State<DashboardScreen> createState() => DashboardScreenState();
}

class DashboardScreenState extends State<DashboardScreen> {
  final _apiService = ApiService();
  Map<String, dynamic>? _stats;
  bool _isLoading = true;
  String? _selectedUserId;
  Map<String, dynamic>? _userStats;

  @override
  void initState() {
    super.initState();
    fetchMainStats();
  }

  Future<void> fetchMainStats() async {
    setState(() => _isLoading = true);
    try {
      final response = await _apiService.get('/dashboard/stats');
      if (response.statusCode == 200) {
        setState(() {
          _stats = json.decode(response.body);
        });
      }
    } catch (e) {
      print('Error fetching stats: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchUserDetails(String userId) async {
    try {
      final response = await _apiService.get('/dashboard/stats?target_user_id=$userId');
      if (response.statusCode == 200) {
        setState(() {
          _userStats = json.decode(response.body);
          _selectedUserId = userId;
        });
      }
    } catch (e) {
      print('Error fetching user stats: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final currencyFormat = NumberFormat.currency(symbol: '₹', locale: 'en_IN', decimalDigits: 0);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back, ${widget.user.fullName.split(' ')[0]}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontSize: 22,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "Here's your business overview for today.",
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              if (widget.user.role == UserRole.user)
                Container(
                  decoration: BoxDecoration(
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.2),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final result = await Navigator.pushNamed(context, '/invoices/new');
                      if (result == true) fetchMainStats();
                    },
                    icon: const Icon(Icons.add_rounded, size: 20),
                    label: const Text('New Invoice'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 32),
          _buildStatsGrid(currencyFormat),
          const SizedBox(height: 32),
          if (widget.user.role != UserRole.user) ...[
            _buildManagementTree(),
            if (_selectedUserId != null && _userStats != null) ...[
              const SizedBox(height: 24),
              _buildUserPerformance(currencyFormat),
            ],
          ],
          if (widget.user.role != UserRole.user) ...[
            const SizedBox(height: 24),
            _buildSystemStatus(),
          ],
          const SizedBox(height: 24),
          _buildHelpCard(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildStatsGrid(NumberFormat currencyFormat) {
    List<_StatsCard> cards = [];
    if (widget.user.role == UserRole.super_admin) {
      cards = [
        _StatsCard(title: 'REVENUE', value: currencyFormat.format(_stats?['total_sales'] ?? 0), icon: Icons.trending_up_rounded, color: AppColors.primary, trend: '+12.5%'),
        _StatsCard(title: 'ADMINS', value: (_stats?['total_admins'] ?? 0).toString(), icon: Icons.shield_rounded, color: const Color(0xFF7C3AED)),
        _StatsCard(title: 'ACTIVE USERS', value: (_stats?['total_users'] ?? 0).toString(), icon: Icons.people_rounded, color: const Color(0xFF0891B2)),
        _StatsCard(title: 'INVOICES', value: (_stats?['total_invoices'] ?? 0).toString(), icon: Icons.description_rounded, color: const Color(0xFFD97706)),
      ];
    } else if (widget.user.role == UserRole.admin) {
      cards = [
        _StatsCard(title: 'MY USERS', value: (_stats?['active_users'] ?? 0).toString(), icon: Icons.people_rounded, color: AppColors.primary),
        _StatsCard(title: 'TRANSACTIONS', value: (_stats?['total_invoices'] ?? 0).toString(), icon: Icons.credit_card_rounded, color: const Color(0xFF0891B2)),
        _StatsCard(title: 'REVENUE', value: currencyFormat.format(_stats?['total_sales'] ?? 0), icon: Icons.trending_up_rounded, color: const Color(0xFF16A34A)),
      ];
    } else {
      cards = [
        _StatsCard(title: 'TOTAL SALES', value: currencyFormat.format(_stats?['total_sales'] ?? 0), icon: Icons.trending_up_rounded, color: AppColors.primary, trend: '+8.2%'),
        _StatsCard(title: 'CUSTOMERS', value: (_stats?['total_clients'] ?? 0).toString(), icon: Icons.people_rounded, color: const Color(0xFF0891B2)),
        _StatsCard(title: 'INVENTORY', value: (_stats?['total_products'] ?? 0).toString(), icon: Icons.inventory_2_rounded, color: const Color(0xFFD97706)),
        _StatsCard(
          title: 'INVOICES', 
          value: (_stats?['total_invoices'] ?? 0).toString(), 
          icon: Icons.description_rounded, 
          color: const Color(0xFF7C3AED),
          onTap: () => Navigator.pushNamed(context, '/invoices', arguments: widget.user),
        ),
      ];
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: cards.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 1.15,
      ),
      itemBuilder: (context, index) => cards[index],
    );
  }

  Widget _buildManagementTree() {
    final users = List<Map<String, dynamic>>.from(_stats?['admins'] ?? _stats?['managed_users'] ?? []);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Management Tree', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(6)),
                  child: const Text('CLICK TO VIEW STATS', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                ),
              ],
            ),
            const SizedBox(height: 20),
            ...users.map((u) => Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: InkWell(
                onTap: () => _fetchUserDetails(u['id']),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Icons.person_rounded, color: AppColors.primary, size: 18),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(u['full_name'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
                            Text(u['email'], style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFCBD5E1)),
                    ],
                  ),
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildUserPerformance(NumberFormat currencyFormat) {
    final invoices = List<Map<String, dynamic>>.from(_userStats?['invoices'] ?? []);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary, width: 2),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("${_userStats?['target_name']}'s Performance", style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.text)),
                IconButton(
                  onPressed: () => setState(() => _selectedUserId = null),
                  icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
                  style: IconButton.styleFrom(backgroundColor: AppColors.background),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatItem(label: 'REVENUE', value: currencyFormat.format(_userStats?['total_sales'] ?? 0)),
                  Container(width: 1, height: 30, color: const Color(0xFFE2E8F0)),
                  _StatItem(label: 'INVOICES', value: (_userStats?['total_invoices'] ?? 0).toString()),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text('RECENT ACTIVITY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
          ),
          const SizedBox(height: 8),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: invoices.length > 5 ? 5 : invoices.length,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final inv = invoices[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFF1F5F9))),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(inv['invoice_number'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          Text(DateFormat('dd MMM, yyyy').format(DateTime.parse(inv['created_at'])), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                    Text(currencyFormat.format(inv['total_amount']), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.text)),
                  ],
                ),
              );
            },
          ),
          if (invoices.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32.0),
              child: Center(child: Text('No recent activity', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildSystemStatus() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.bolt_rounded, color: AppColors.primary, size: 20),
                SizedBox(width: 8),
                Text('System Status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
              ],
            ),
            const SizedBox(height: 20),
            const _StatusRow(label: 'API STATUS', value: 'ONLINE', isSuccess: true),
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
            const _StatusRow(label: 'DATABASE', value: 'STABLE', isSuccess: true),
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
            const _StatusRow(label: 'BACKUPS', value: '2h ago', isSuccess: true, customValue: 'UPDATED'),
          ],
        ),
      ),
    );
  }

  Widget _buildHelpCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, Color(0xFF1D4ED8)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Need help?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
          const SizedBox(height: 8),
          Text(
            'Check out our professional documentation or contact support for advanced integration.',
            style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('View Guide'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final String? trend;
  final VoidCallback? onTap;

  const _StatsCard({required this.title, required this.value, required this.icon, required this.color, this.trend, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  if (trend != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(20)),
                      child: Row(
                        children: [
                          const Icon(Icons.arrow_upward_rounded, size: 10, color: Color(0xFF16A34A)),
                          const SizedBox(width: 2),
                          Text(trend!, style: const TextStyle(color: Color(0xFF16A34A), fontSize: 9, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                  const SizedBox(height: 4),
                  Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text, letterSpacing: -0.5)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.text)),
      ],
    );
  }
}

class _StatusRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isSuccess;
  final String? customValue;
  const _StatusRow({required this.label, required this.value, required this.isSuccess, this.customValue});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
        Row(
          children: [
            if (customValue != null)
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: Text(value, style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isSuccess ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(customValue ?? value, style: TextStyle(color: isSuccess ? const Color(0xFF16A34A) : const Color(0xFFDC2626), fontSize: 10, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ],
    );
  }
}
