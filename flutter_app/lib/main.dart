import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/providers.dart';
import 'core/routes.dart';
import 'core/theme/app_theme.dart';
import 'data/storage/secure_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize storage service
  final storageService = await StorageService.init();

  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final companyState = ref.watch(companyProvider);
    final company = companyState.companyData;

    // Build the dynamic theme based on custom company branding parameters
    final theme = AppTheme.buildTheme(
      company?['primary_color'],
      company?['secondary_color'],
    );

    return MaterialApp.router(
      title: 'Digital Viyabari',
      debugShowCheckedModeBanner: false,
      theme: theme,
      routerConfig: router,
    );
  }
}
