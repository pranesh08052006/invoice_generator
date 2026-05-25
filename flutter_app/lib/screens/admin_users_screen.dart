import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../utils/app_theme.dart';

class AdminUsersScreen extends StatefulWidget {
  final UserModel currentUser;
  const AdminUsersScreen({super.key, required this.currentUser});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final _apiService = ApiService();
  List<dynamic> _users = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    setState(() => _isLoading = true);
    try {
      final response = await _apiService.get('/admin/users');
      if (response.statusCode == 200) {
        setState(() {
          _users = json.decode(response.body);
        });
      }
    } catch (e) {
      print('Error fetching users: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.currentUser.role == UserRole.super_admin ? 'Manage Managers' : 'Manage Employees'),
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _users.isEmpty
              ? _buildEmptyState()
              : ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                  itemCount: _users.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final user = _users[index];
                    return _buildUserCard(user);
                  },
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddUserDialog,
        backgroundColor: AppColors.primary,
        elevation: 4,
        icon: const Icon(Icons.person_add_rounded, color: Colors.white),
        label: Text(
          widget.currentUser.role == UserRole.super_admin ? 'Add Manager' : 'Add Employee',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.manage_accounts_outlined, size: 64, color: AppColors.textMuted.withOpacity(0.3)),
          const SizedBox(height: 16),
          const Text(
            'No users found',
            style: TextStyle(color: AppColors.textMuted, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          const Text(
            'Add your team members to manage them',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildUserCard(dynamic user) {
    final role = user['role'].toString().toUpperCase();
    final isManager = role == 'ADMIN';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: const Color(0xFFEFF6FF),
              child: Text(
                user['full_name'][0],
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 18),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user['full_name'],
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user['email'],
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: isManager ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isManager ? 'MANAGER' : 'EMPLOYEE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: isManager ? AppColors.primary : const Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => _handleDelete(user['id']),
              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 22),
              style: IconButton.styleFrom(backgroundColor: const Color(0xFFFEF2F2)),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddUserDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    String role = widget.currentUser.role == UserRole.super_admin ? 'admin' : 'user';

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
                  Text(widget.currentUser.role == UserRole.super_admin ? 'New Manager' : 'New Employee', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('User Information', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 12),
                    TextField(controller: nameController, decoration: const InputDecoration(hintText: 'Full Name', prefixIcon: Icon(Icons.person_outline, size: 20))),
                    const SizedBox(height: 16),
                    TextField(controller: emailController, decoration: const InputDecoration(hintText: 'Email Address', prefixIcon: Icon(Icons.mail_outline, size: 20)), keyboardType: TextInputType.emailAddress),
                    const SizedBox(height: 16),
                    TextField(controller: passwordController, decoration: const InputDecoration(hintText: 'Password', prefixIcon: Icon(Icons.lock_outline, size: 20)), obscureText: true),
                    const SizedBox(height: 24),
                    const Text('Access Level', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: role,
                      decoration: const InputDecoration(prefixIcon: Icon(Icons.shield_outlined, size: 20)),
                      items: widget.currentUser.role == UserRole.super_admin
                          ? [const DropdownMenuItem(value: 'admin', child: Text('Admin (Manager)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)))]
                          : [const DropdownMenuItem(value: 'user', child: Text('User (Employee)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)))],
                      onChanged: (val) => role = val!,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
                ElevatedButton(
                  onPressed: () async {
                    if (nameController.text.isEmpty || emailController.text.isEmpty || passwordController.text.isEmpty) return;
                    final body = {
                      'full_name': nameController.text,
                      'email': emailController.text,
                      'password': passwordController.text,
                      'role': role,
                    };
                    final response = await _apiService.post('/admin/users', body);
                    if (response.statusCode == 200) {
                      if (mounted) Navigator.pop(context);
                      _fetchUsers();
                    }
                  },
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
                  child: const Text('Add User'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleDelete(String userId) async {
    final confirm = await showGeneralDialog<bool>(
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
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Text('Remove User?', style: TextStyle(fontWeight: FontWeight.w800)),
              content: const Text('Are you sure you want to remove this user from the system? This action cannot be undone.', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep User', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700))),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context, true), 
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white),
                  child: const Text('Remove Now', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirm == true) {
      try {
        final response = await _apiService.delete('/admin/users/$userId');
        if (response.statusCode == 200) {
          _fetchUsers();
        } else {
          final data = json.decode(response.body);
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(data['detail'] ?? 'Error removing user'), backgroundColor: AppColors.error));
        }
      } catch (e) {
        print('Error deleting user: $e');
      }
    }
  }
}
