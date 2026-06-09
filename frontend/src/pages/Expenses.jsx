import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  Plus, Calendar, CreditCard, Trash2, Edit3, X, 
  Search, ChevronDown, Download, FileText, ListCollapse
} from 'lucide-react';

const Expenses = ({ user }) => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Custom quick-add inline state
  const [showAddCategoryInline, setShowAddCategoryInline] = useState(false);
  const [showAddPaymentModeInline, setShowAddPaymentModeInline] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newPaymentModeInput, setNewPaymentModeInput] = useState('');

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL');
  const [dateRangeType, setDateRangeType] = useState('ALL'); // ALL, TODAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    payment_mode: '',
    date: new Date().toISOString().substring(0, 10),
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const expRes = await axios.get(`${API_BASE_URL}/expenses`);
      setExpenses(expRes.data);
      
      const catRes = await axios.get(`${API_BASE_URL}/expense-categories`);
      setCategories(catRes.data);
      
      const modeRes = await axios.get(`${API_BASE_URL}/payment-modes`);
      setPaymentModes(modeRes.data);
    } catch (err) {
      console.error("Failed to fetch expense data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/expense-categories`, { name: trimmed });
      setCategories(prev => {
        if (prev.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, res.data];
      });
      setFormData(prev => ({ ...prev, category: res.data.name }));
      setNewCategoryInput('');
      setShowAddCategoryInline(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/expense-categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
      // Refresh list to clear any dependencies
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPaymentMode = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/payment-modes`, { name: trimmed });
      setPaymentModes(prev => {
        if (prev.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, res.data];
      });
      setFormData(prev => ({ ...prev, payment_mode: res.data.name }));
      setNewPaymentModeInput('');
      setShowAddPaymentModeInline(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add payment mode');
    }
  };

  const handleDeletePaymentMode = async (id) => {
    if (!window.confirm("Are you sure you want to delete this payment mode?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/payment-modes/${id}`);
      setPaymentModes(prev => prev.filter(m => m.id !== id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.payment_mode) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const payload = {
        amount: Number(formData.amount),
        category: formData.category,
        payment_mode: formData.payment_mode,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes
      };

      if (editingId) {
        await axios.put(`${API_BASE_URL}/expenses/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/expenses`, payload);
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({
        amount: '',
        category: '',
        payment_mode: '',
        date: new Date().toISOString().substring(0, 10),
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save expense');
    }
  };

  const handleEditExpense = (exp) => {
    setEditingId(exp.id);
    setFormData({
      amount: exp.amount,
      category: exp.category,
      payment_mode: exp.payment_mode,
      date: exp.date.substring(0, 10),
      notes: exp.notes || ''
    });
    setShowModal(true);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/expenses/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete expense");
    }
  };

  // Filter Logic
  const getFilteredExpenses = () => {
    return expenses.filter(exp => {
      // 1. Search term
      const matchesSearch = 
        (exp.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.payment_mode || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Category filter
      if (categoryFilter !== 'ALL' && exp.category !== categoryFilter) return false;

      // 3. Payment Mode filter
      if (paymentModeFilter !== 'ALL' && exp.payment_mode !== paymentModeFilter) return false;

      // 4. Date filter
      if (dateRangeType !== 'ALL') {
        const expDate = new Date(exp.date);
        expDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (dateRangeType === 'TODAY') {
          if (expDate.getTime() !== today.getTime()) return false;
        } else if (dateRangeType === 'THIS_WEEK') {
          const dayOfWeek = today.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek);
          startOfWeek.setHours(0,0,0,0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23,59,59,999);
          if (expDate < startOfWeek || expDate > endOfWeek) return false;
        } else if (dateRangeType === 'THIS_MONTH') {
          if (expDate.getFullYear() !== today.getFullYear() || expDate.getMonth() !== today.getMonth()) return false;
        } else if (dateRangeType === 'CUSTOM') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0,0,0,0);
            if (expDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23,59,59,999);
            if (expDate > end) return false;
          }
        }
      }

      return true;
    });
  };

  const filteredExpenses = getFilteredExpenses();

  // Metrics
  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const thisMonthYear = now.getFullYear();
  const thisMonthVal = now.getMonth();
  
  const todayAmount = expenses
    .filter(exp => exp.date.substring(0, 10) === todayStr)
    .reduce((sum, exp) => sum + exp.amount, 0);
    
  const monthAmount = expenses
    .filter(exp => {
      const d = new Date(exp.date);
      return d.getFullYear() === thisMonthYear && d.getMonth() === thisMonthVal;
    })
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Exports
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Category,Amount,Payment Mode,Notes\n";
    filteredExpenses.forEach(exp => {
      const formattedDate = new Date(exp.date).toLocaleDateString('en-IN');
      const cleanNotes = (exp.notes || '').replace(/"/g, '""');
      csvContent += `"${formattedDate}","${exp.category}",${exp.amount},"${exp.payment_mode}","${cleanNotes}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expense_report_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Expense Report</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111827; padding: 40px; margin: 0; }
            .header { border-bottom: 2px solid #eaedf3; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 24px; font-weight: 800; color: #ef4444; margin: 0; }
            .date { font-size: 12px; color: #6b7280; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { padding: 12px 16px; font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; background-color: #f8fafc; border-bottom: 1px solid #eaedf3; text-align: left; }
            td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .text-right { text-align: right; }
            .total-row { background-color: #fafafa; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">EXPENSE REPORT</h1>
              <div class="date">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
            </div>
            <div>
              <strong style="font-size: 16px;">Expense Management</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Payment Mode</th>
                <th>Notes</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredExpenses.map(exp => `
                <tr>
                  <td>${new Date(exp.date).toLocaleDateString('en-IN')}</td>
                  <td><strong>${exp.category}</strong></td>
                  <td>${exp.payment_mode}</td>
                  <td>${exp.notes || '-'}</td>
                  <td class="text-right">₹${exp.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4">TOTAL EXPENSES</td>
                <td class="text-right">₹${totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      amount: '',
      category: '',
      payment_mode: '',
      date: new Date().toISOString().substring(0, 10),
      notes: ''
    });
    setShowAddCategoryInline(false);
    setShowAddPaymentModeInline(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
      <div className="loading-spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Loading Expenses...</span>
    </div>
  );

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
            Expense Management
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Record and track daily business expenses.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button"
            onClick={() => setShowManageModal(true)} 
            style={{ 
              backgroundColor: '#ffffff',
              color: '#4b5563',
              border: '1px solid #eaedf3',
              borderRadius: '8px',
              padding: '10px 20px', 
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <ListCollapse size={16} /> Manage Masters
          </button>
          <button 
            type="button"
            onClick={() => setShowModal(true)} 
            style={{ 
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px', 
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        
        {/* Total Expenses */}
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filtered Expenses
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#ef4444' }}>
            ₹{totalAmount.toLocaleString()}
          </div>
          <CreditCard size={18} style={{ position: 'absolute', right: '24px', top: '24px', color: '#ef4444' }} />
        </div>

        {/* Today's Expenses */}
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today's Expenses
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#f59e0b' }}>
            ₹{todayAmount.toLocaleString()}
          </div>
          <Calendar size={18} style={{ position: 'absolute', right: '24px', top: '24px', color: '#f59e0b' }} />
        </div>

        {/* This Month Expenses */}
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            This Month's Expenses
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#3b82f6' }}>
            ₹{monthAmount.toLocaleString()}
          </div>
          <Calendar size={18} style={{ position: 'absolute', right: '24px', top: '24px', color: '#3b82f6' }} />
        </div>

        {/* Total Count */}
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Entries
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#111827' }}>
            {filteredExpenses.length}
          </div>
          <ListCollapse size={18} style={{ position: 'absolute', right: '24px', top: '24px', color: '#9ca3af' }} />
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ 
        padding: '16px 24px', 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '16px', 
        alignItems: 'center', 
        backgroundColor: '#ffffff',
        border: '1px solid #eaedf3',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search notes or category..." 
            style={{ 
              width: '100%',
              height: '42px',
              paddingLeft: '42px', 
              paddingRight: '16px',
              border: '1px solid #e2e8f0', 
              backgroundColor: '#ffffff',
              borderRadius: '8px', 
              fontSize: '14px',
              fontWeight: '500',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#ef4444'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* Category Filter */}
        <div style={{ position: 'relative', width: '160px' }}>
          <select 
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 32px 0 14px',
              border: `1px solid ${categoryFilter !== 'ALL' ? '#ef4444' : '#e2e8f0'}`,
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: categoryFilter !== 'ALL' ? '#ef4444' : '#4b5563',
              backgroundColor: categoryFilter !== 'ALL' ? '#fef2f2' : '#ffffff',
              appearance: 'none',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
        </div>

        {/* Payment Mode Filter */}
        <div style={{ position: 'relative', width: '160px' }}>
          <select 
            value={paymentModeFilter}
            onChange={e => setPaymentModeFilter(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 32px 0 14px',
              border: `1px solid ${paymentModeFilter !== 'ALL' ? '#ef4444' : '#e2e8f0'}`,
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: paymentModeFilter !== 'ALL' ? '#ef4444' : '#4b5563',
              backgroundColor: paymentModeFilter !== 'ALL' ? '#fef2f2' : '#ffffff',
              appearance: 'none',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Payment Modes</option>
            {paymentModes.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
        </div>

        {/* Date Filter Selector */}
        <div style={{ position: 'relative', width: '150px' }}>
          <select 
            value={dateRangeType}
            onChange={e => setDateRangeType(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 32px 0 14px',
              border: `1px solid ${dateRangeType !== 'ALL' ? '#ef4444' : '#e2e8f0'}`,
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: dateRangeType !== 'ALL' ? '#ef4444' : '#4b5563',
              backgroundColor: dateRangeType !== 'ALL' ? '#fef2f2' : '#ffffff',
              appearance: 'none',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
        </div>

        {dateRangeType === 'CUSTOM' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={e => setCustomStartDate(e.target.value)}
              style={{ height: '42px', padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
            />
            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>to</span>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={e => setCustomEndDate(e.target.value)}
              style={{ height: '42px', padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>
        )}

        <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

        {/* Exports Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            onClick={handleExportPDF}
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
          >
            <FileText size={14} /> PDF
          </button>
          <button 
            type="button" 
            onClick={handleExportCSV}
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
          >
            <Download size={14} /> Excel (CSV)
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: '0', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%', paddingLeft: '32px' }}>Date</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '20%' }}>Category</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '20%' }}>Payment Mode</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Notes</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'right', paddingRight: '32px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map(exp => (
              <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s ease' }}>
                <td style={{ padding: '16px 24px', paddingLeft: '32px', fontSize: '13.5px', fontWeight: '500', color: '#4b5563' }}>
                  {new Date(exp.date).toLocaleDateString('en-IN')}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: '14px', color: '#111827', fontWeight: '700' }}>
                    {exp.category}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{
                    backgroundColor: '#f3f4f6',
                    color: '#4b5563',
                    borderRadius: '9999px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    {exp.payment_mode}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13.5px', color: '#6b7280' }}>
                  {exp.notes || '-'}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '800', fontSize: '14.5px', color: '#ef4444' }}>
                  ₹{exp.amount.toLocaleString()}
                </td>
                <td style={{ padding: '16px 24px', paddingRight: '32px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button 
                      type="button"
                      onClick={() => handleEditExpense(exp)}
                      style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justify: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justify: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                  No expenses recorded matching the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            backgroundColor: '#ffffff', maxHeight: '90vh', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            border: '1px solid #eaedf3'
          }}>
            
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} style={{ color: '#ef4444' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
                  {editingId ? 'Edit Expense Record' : 'Record New Expense'}
                </h2>
              </div>
              <button onClick={closeModal} style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              
              {/* Amount */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Amount (₹) *</label>
                <input 
                  type="number"
                  placeholder="e.g. 1500"
                  required
                  min="0"
                  step="any"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Category *</label>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddCategoryInline(!showAddCategoryInline); setShowAddPaymentModeInline(false); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    ➕ Create New Category
                  </button>
                </div>

                {showAddCategoryInline && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                    <input 
                      placeholder="Category Name"
                      value={newCategoryInput}
                      onChange={e => setNewCategoryInput(e.target.value)}
                      style={{ flex: 1, height: '36px', padding: '0 10px', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '13px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddCategory(newCategoryInput)}
                      style={{ height: '36px', padding: '0 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                )}

                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  style={{ height: '42px', padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Payment Mode */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Payment Mode *</label>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddPaymentModeInline(!showAddPaymentModeInline); setShowAddCategoryInline(false); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    ➕ Add New Payment Mode
                  </button>
                </div>

                {showAddPaymentModeInline && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                    <input 
                      placeholder="Payment Mode"
                      value={newPaymentModeInput}
                      onChange={e => setNewPaymentModeInput(e.target.value)}
                      style={{ flex: 1, height: '36px', padding: '0 10px', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '13px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddPaymentMode(newPaymentModeInput)}
                      style={{ height: '36px', padding: '0 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                )}

                <select
                  required
                  value={formData.payment_mode}
                  onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}
                  style={{ height: '42px', padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  <option value="">Select Mode</option>
                  {paymentModes.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                </select>
              </div>

              {/* Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Date *</label>
                <input 
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              {/* Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Notes (Optional)</label>
                <textarea 
                  placeholder="e.g. Dinner with clients"
                  rows="3"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={closeModal} 
                  style={{ flex: 1, height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: '700', color: '#4b5563', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, height: '44px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', color: '#fff', backgroundColor: '#ef4444', cursor: 'pointer' }}
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Masters Modal */}
      {showManageModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowManageModal(false); }}
        >
          <div style={{
            backgroundColor: '#ffffff', maxHeight: '80vh', width: '100%', maxWidth: '640px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            border: '1px solid #eaedf3'
          }}>
            
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ListCollapse size={18} style={{ color: '#4b5563' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
                  Manage Expense Masters
                </h2>
              </div>
              <button onClick={() => setShowManageModal(false)} style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', overflowY: 'auto' }}>
              {/* Categories column */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0' }}>Expense Categories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                  {categories.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #eaedf3', borderRadius: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{c.name}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteCategory(c.id)}
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', padding: '12px 0' }}>No categories found</div>
                  )}
                </div>
              </div>

              {/* Payment modes column */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0' }}>Payment Modes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                  {paymentModes.map(pm => (
                    <div key={pm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #eaedf3', borderRadius: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{pm.name}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDeletePaymentMode(pm.id)}
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {paymentModes.length === 0 && (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', padding: '12px 0' }}>No modes found</div>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ padding: '20px 32px', borderTop: '1px solid #eaedf3', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
              <button 
                type="button" 
                onClick={() => setShowManageModal(false)}
                style={{ height: '38px', padding: '0 20px', backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close Masters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
