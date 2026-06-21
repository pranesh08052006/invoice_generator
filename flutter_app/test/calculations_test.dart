import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/features/transactions/domain/transaction_model.dart';
import 'package:flutter_app/features/transactions/domain/transaction_item_model.dart';

void main() {
  group('Transaction Calculation Engine Tests', () {
    test('Line item subtotal, gstAmount, and total calculations with percentage discount', () {
      final item = TransactionItemModel(
        productName: 'Soap',
        quantity: 5,
        price: 100.0,
        discountValue: 10.0,
        discountType: 'percentage',
        gstPercent: 18.0,
      );

      // Raw = 5 * 100 = 500
      // Disc = 10% of 500 = 50
      // subTotal = 450
      // gstAmount = 18% of 450 = 81
      // total = 450 + 81 = 531
      expect(item.subTotal, equals(450.0));
      expect(item.gstAmount, equals(81.0));
      expect(item.total, equals(531.0));
    });

    test('Line item subtotal, gstAmount, and total calculations with amount discount', () {
      final item = TransactionItemModel(
        productName: 'Toothbrush',
        quantity: 2,
        price: 75.0,
        discountValue: 10.0,
        discountType: 'amount',
        gstPercent: 12.0,
      );

      // Raw = 2 * 75 = 150
      // Disc = 10
      // subTotal = 140
      // gstAmount = 12% of 140 = 16.8
      // total = 140 + 16.8 = 156.8
      expect(item.subTotal, equals(140.0));
      expect(item.gstAmount, equals(16.8));
      expect(item.total, equals(156.8));
    });

    test('TransactionModel.calculateTotals with multiple items, global percentage discount, GST enabled', () {
      final item1 = TransactionItemModel(
        productName: 'Item 1',
        quantity: 2,
        price: 200.0,
        discountValue: 10.0, // 10% discount
        discountType: 'percentage',
        gstPercent: 18.0,
      );

      final item2 = TransactionItemModel(
        productName: 'Item 2',
        quantity: 1,
        price: 500.0,
        discountValue: 50.0, // ₹50 flat discount
        discountType: 'amount',
        gstPercent: 12.0,
      );

      final result = TransactionModel.calculateTotals(
        items: [item1, item2],
        discountValue: 5.0, // 5% global discount
        discountType: 'percentage',
        isGst: true,
      );

      // Item 1: Raw=400, Disc=40, Taxable=360, GST=18% of 360 = 64.8
      // Item 2: Raw=500, Disc=50, Taxable=450, GST=12% of 450 = 54.0
      // subTotal = 360 + 450 = 810
      // totalGst = 64.8 + 54 = 118.8
      // Global discount = 5% of 810 = 40.5
      // totalAmount = 810 + 118.8 - 40.5 = 888.3
      expect(result['subTotal'], closeTo(810.0, 0.0001));
      expect(result['totalGst'], closeTo(118.8, 0.0001));
      expect(result['totalAmount'], closeTo(888.3, 0.0001));
    });

    test('TransactionModel.calculateTotals with GST disabled', () {
      final item = TransactionItemModel(
        productName: 'Item',
        quantity: 10,
        price: 50.0,
        gstPercent: 18.0,
      );

      final result = TransactionModel.calculateTotals(
        items: [item],
        discountValue: 10.0, // ₹10 discount
        discountType: 'amount',
        isGst: false,
      );

      // subTotal = 500
      // totalGst = 0 (GST disabled)
      // global discount = 10
      // totalAmount = 500 - 10 = 490
      expect(result['subTotal'], equals(500.0));
      expect(result['totalGst'], equals(0.0));
      expect(result['totalAmount'], equals(490.0));
    });
  });
}
