import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/clients_screen.dart';
import 'screens/products_screen.dart';
import 'screens/invoices_screen.dart';
import 'screens/create_invoice_screen.dart';
import 'screens/admin_users_screen.dart';
import 'screens/settings_screen.dart';
import 'services/auth_service.dart';
import 'utils/app_theme.dart';
import 'models/user_model.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Invoicer',
      theme: AppTheme.theme,
      debugShowCheckedModeBanner: false,
      initialRoute: '/check',
      onGenerateRoute: (settings) {
        if (settings.name == '/check') return MaterialPageRoute(builder: (context) => const AuthCheck());
        if (settings.name == '/login') return MaterialPageRoute(builder: (context) => const LoginScreen());
        if (settings.name == '/') return MaterialPageRoute(builder: (context) => const MainLayout());
        
        // Modal / Push screens
        if (settings.name == '/clients') return MaterialPageRoute(builder: (context) => const ClientsScreen());
        if (settings.name == '/products') return MaterialPageRoute(builder: (context) => const ProductsScreen());
        if (settings.name == '/invoices') {
          final user = settings.arguments as UserModel?;
          if (user == null) return MaterialPageRoute(builder: (context) => const AuthCheck());
          return MaterialPageRoute(builder: (context) => InvoicesScreen(user: user));
        }
        if (settings.name == '/invoices/new') return MaterialPageRoute(builder: (context) => const CreateInvoiceScreen());
        if (settings.name == '/admin/users') {
          final user = settings.arguments as UserModel?;
          if (user == null) return MaterialPageRoute(builder: (context) => const AuthCheck());
          return MaterialPageRoute(builder: (context) => AdminUsersScreen(currentUser: user));
        }
        if (settings.name == '/settings') return MaterialPageRoute(builder: (context) => const SettingsScreen());
        
        return null;
      },
    );
  }
}

class AuthCheck extends StatefulWidget {
  const AuthCheck({super.key});

  @override
  State<AuthCheck> createState() => _AuthCheckState();
}

class _AuthCheckState extends State<AuthCheck> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  void _checkAuth() async {
    final authService = AuthService();
    final token = await authService.getToken();
    if (token != null) {
      if (mounted) Navigator.pushReplacementNamed(context, '/');
    } else {
      if (mounted) Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  final _authService = AuthService();
  UserModel? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  void _loadUser() async {
    final user = await _authService.getUser();
    setState(() {
      _user = user;
    });
  }

  void _refreshDashboard() {
    setState(() {}); // This will rebuild DashboardScreen and trigger its initState if we change the key, or we can just call fetchStats if we have a key.
  }

  final GlobalKey<DashboardScreenState> _dashboardKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    if (_user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(
        title: Image.asset('assets/logo.png', height: 28),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: false,
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_outlined, color: AppColors.textMuted),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: () async {
              await _authService.logout();
              if (mounted) Navigator.pushReplacementNamed(context, '/login');
            },
            icon: const Icon(Icons.logout_rounded, color: AppColors.error),
          ),
          const SizedBox(width: 8),
        ],
      ),
      drawer: Drawer(
        backgroundColor: AppColors.sidebarBg,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(20, 60, 20, 30),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      _user!.fullName[0],
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _user!.fullName,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
                        ),
                        Text(
                          _user!.role.name.replaceAll('_', ' ').toUpperCase(),
                          style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: [
                  _buildDrawerItem(
                    icon: Icons.dashboard_rounded,
                    title: 'Overview',
                    onTap: () {
                      Navigator.pop(context);
                      _dashboardKey.currentState?.fetchMainStats();
                    },
                  ),
                  if (_user!.role == UserRole.user) ...[
                    const Padding(
                      padding: EdgeInsets.fromLTRB(24, 20, 24, 8),
                      child: Text('TRANSACTIONS', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.0)),
                    ),
                    _buildDrawerItem(
                      icon: Icons.add_circle_rounded,
                      title: 'New Invoice',
                      onTap: () async {
                        Navigator.pop(context);
                        final result = await Navigator.pushNamed(context, '/invoices/new');
                        if (result == true) _dashboardKey.currentState?.fetchMainStats();
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.people_rounded,
                      title: 'Customers',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/clients');
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.inventory_2_rounded,
                      title: 'Inventory',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/products');
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.description_rounded,
                      title: 'Transactions',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/invoices', arguments: _user);
                      },
                    ),
                  ],
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    child: Divider(color: Color(0xFF334155)),
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(24, 8, 24, 8),
                    child: Text('ADMINISTRATION', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.0)),
                  ),
                  if (_user!.role == UserRole.super_admin || _user!.role == UserRole.admin)
                    _buildDrawerItem(
                      icon: Icons.manage_accounts_rounded,
                      title: _user!.role == UserRole.super_admin ? "Manage Managers" : "Manage Employees",
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/admin/users', arguments: _user);
                      },
                    ),
                  _buildDrawerItem(
                    icon: Icons.settings_rounded,
                    title: 'Company Profile',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, '/settings');
                    },
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(20),
              color: const Color(0xFF0F172A),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shield_rounded, color: AppColors.primary, size: 16),
                  SizedBox(width: 8),
                  Text('Secure Cloud Sync', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: DashboardScreen(key: _dashboardKey, user: _user!),
    );
  }

  Widget _buildDrawerItem({required IconData icon, required String title, required VoidCallback onTap}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      leading: Icon(icon, color: Colors.white.withOpacity(0.7), size: 22),
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
      onTap: onTap,
      hoverColor: Colors.white.withOpacity(0.05),
    );
  }
}
