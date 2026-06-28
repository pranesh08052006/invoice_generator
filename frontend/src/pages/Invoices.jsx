import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  Download, Share2, Plus, Search, FileText, Trash2,
  User, Calendar, CheckCircle, Eye, X, Copy, ChevronDown, MoreVertical, CreditCard, AlertTriangle
} from 'lucide-react';

const Invoices = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(location.state?.clientName || '');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PAID, UNPAID, DRAFT
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Duplication State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [duplicateDate, setDuplicateDate] = useState(new Date().toISOString().split('T')[0]);
  const [duplicating, setDuplicating] = useState(false);
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'CASH', notes: '' });
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const navigate = useNavigate();

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/invoices`);
      setInvoices(response.data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients`);
      setClients(response.data);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/payments`);
      setPayments(response.data || []);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    }
  };

  useEffect(() => { 
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchInvoices(),
          fetchClients(),
          fetchPayments()
        ]);
      } catch (err) {
        console.error("Failed to load invoice data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDownload = async (id, number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `INV_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert('Failed to download PDF.');
    }
  };

  const handleView = async (id) => {
    try {
      const inv = invoices.find(i => i.id === id);
      setSelectedInv(inv);
      const response = await axios.get(`${API_BASE_URL}/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      alert('Failed to preview invoice.');
    }
  };

  const handleShare = async (id, number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/invoices/${id}/pdf`, { responseType: 'blob' });
      const file = new File([response.data], `INV_${number}.pdf`, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: `INV ${number}` });
      } else {
        alert('Share not supported on this browser.');
      }
    } catch (err) {
      alert('Failed to share.');
    }
  };

  const handleDuplicate = async () => {
    if (!selectedInvoice || !duplicateDate) return;
    
    setDuplicating(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        client_id: selectedInvoice.client_id,
        invoice_number: `INV-${Date.now().toString().slice(-4)}`, 
        date: duplicateDate,
        discount_type: selectedInvoice.discount_type || 'percentage',
        discount_value: selectedInvoice.discount_value || 0,
        paid_amount: 0, 
        status: 'UNPAID',
        payment_mode: selectedInvoice.payment_mode || 'CASH',
        items: selectedInvoice.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          discount_value: item.discount_value || 0,
          discount_type: item.discount_type || 'percentage',
          gst_percent: item.gst_percent !== undefined && item.gst_percent !== null ? item.gst_percent : 0
        }))
      };

      await axios.post(`${API_BASE_URL}/invoices`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowDuplicateModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
      alert("Invoice duplicated successfully!");
    } catch (err) {
      console.error("Duplication failed:", err);
      alert("Failed to duplicate invoice.");
    } finally {
      setDuplicating(false);
    }
  };

  const initiateDelete = (id) => {
    setInvoiceToDelete(id);
    setDeleteConfirmationText('');
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await axios.delete(`${API_BASE_URL}/invoices/${invoiceToDelete}`);
      fetchInvoices();
      setInvoiceToDelete(null);
      setDeleteConfirmationText('');
    } catch (err) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Map client IDs to their display names
    const clientMap = {};
    clients.forEach(c => {
      clientMap[c.id] = c.company_name || c.contact_person || 'N/A';
    });

    const headers = [
      "Invoice Reference",
      "Issued By",
      "Client Name",
      "Date",
      "Subtotal (INR)",
      "GST Tax (INR)",
      "Discount",
      "Net Amount (INR)",
      "Paid Amount (INR)",
      "Balance (INR)",
      "Payment Mode",
      "Status"
    ];

    const rows = filteredInvoices.map(inv => {
      const clientName = clientMap[inv.client_id] || "Unknown Client";
      const subtotal = inv.sub_total || 0;
      const gst = inv.total_gst || 0;
      const discount = inv.discount_value 
        ? `${inv.discount_value}${inv.discount_type === 'percentage' ? '%' : ' INR'}` 
        : '0%';
      const netAmount = inv.total_amount || 0;
      const paid = inv.paid_amount || 0;
      const balance = netAmount - paid;
      const dateFormatted = inv.date 
        ? new Date(inv.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'N/A';

      return [
        inv.invoice_number ? `"${inv.invoice_number.replace(/"/g, '""')}"` : '""',
        inv.user_full_name ? `"${inv.user_full_name.replace(/"/g, '""')}"` : '"User"',
        `"${clientName.replace(/"/g, '""')}"`,
        `"${dateFormatted}"`,
        subtotal.toFixed(2),
        gst.toFixed(2),
        `"${discount}"`,
        netAmount.toFixed(2),
        paid.toFixed(2),
        balance.toFixed(2),
        inv.payment_mode ? `"${inv.payment_mode.replace(/"/g, '""')}"` : '"CASH"',
        inv.status ? `"${inv.status.toUpperCase()}"` : '"UNPAID"'
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Transactions_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const initiatePayment = (inv) => {
    const outstanding = Math.max(0, (inv.total_amount || 0) - (inv.paid_amount || 0));
    setPaymentForm({ amount: outstanding.toString(), payment_method: 'CASH', notes: '' });
    setInvoiceToPay(inv);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!invoiceToPay || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    setSavingPayment(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/payments`, {
        client_id: invoiceToPay.client_id,
        invoice_id: invoiceToPay.id,
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', payment_method: 'CASH', notes: '' });
      setInvoiceToPay(null);
      await fetchInvoices();
      await fetchPayments();
    } catch (err) {
      alert('Failed to record payment. Please try again.');
    } finally {
      setSavingPayment(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const clientName = clients.find(c => c.id === inv.client_id)?.company_name || '';
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.user_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tab filter
    let matchesTab = true;
    if (activeTab === 'PAID') matchesTab = inv.status?.toLowerCase() === 'paid';
    else if (activeTab === 'UNPAID') matchesTab = inv.status?.toLowerCase() !== 'paid' && inv.status?.toLowerCase() !== 'draft';
    else if (activeTab === 'DRAFT') matchesTab = inv.status?.toLowerCase() === 'draft';

    // Status dropdown filter (overrides tab if set)
    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = inv.status?.toUpperCase() === statusFilter;
    }

    // Date range filter
    const now = new Date();
    const invDate = new Date(inv.date);
    let matchesDate = true;
    if (dateRange === '7') {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
      matchesDate = invDate >= cutoff;
    } else if (dateRange === '30') {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - 30);
      matchesDate = invDate >= cutoff;
    } else if (dateRange === '90') {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - 90);
      matchesDate = invDate >= cutoff;
    } else if (dateRange === '365') {
      const cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1);
      matchesDate = invDate >= cutoff;
    } else if (dateRange === 'CUSTOM') {
      matchesDate = (!startDate || invDate >= new Date(startDate)) &&
                    (!endDate   || invDate <= new Date(endDate));
    }
    
    return matchesSearch && matchesTab && matchesStatus && matchesDate;
  });

  const totalVolume = invoices.filter(inv => inv.status?.toLowerCase() !== 'draft').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const unlinkedPayments = payments.filter(p => !p.invoice_id).reduce((sum, p) => sum + (p.amount || 0), 0);
  const realizedRevenue = invoices.filter(inv => inv.status?.toLowerCase() !== 'draft').reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) + unlinkedPayments;
  const pendingSettlement = Math.max(0, totalVolume - realizedRevenue);
  const unpaidCount = invoices.filter(inv => inv.status?.toLowerCase() !== 'paid' && inv.status?.toLowerCase() !== 'draft').length;
  const draftCount = invoices.filter(inv => inv.status?.toLowerCase() === 'draft').length;

  if (loading) {
    return (
      <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
        <div className="loading-spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Loading ledger...</span>
      </div>
    );
  }

  return (
    <>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Redesigned Title Workspace Header */}
      <div style={{ display: 'flex', justifybox: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
            Transactions
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Manage and view all your invoice history.
          </p>
        </div>
        {user?.role !== 'admin' && (
          <button 
            type="button"
            onClick={() => navigate('/invoices/new')} 
            style={{ 
              backgroundColor: 'var(--primary-color)',
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
              boxShadow: '0 2px 4px var(--primary-light)'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
          >
            <Plus size={16} /> New Transaction
          </button>
        )}
      </div>

      {/* Grid row of 3 Premium Metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        
        {/* Total Volume */}
        <div style={{ 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #eaedf3', 
          borderRadius: '12px', 
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Volume
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#111827' }}>
            ₹{totalVolume.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12.5px', color: '#10b981', fontWeight: '700' }}>
            <span>▲ +12%</span>
            <span style={{ color: '#9ca3af', fontWeight: '500' }}>vs last month</span>
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} style={{ color: 'var(--primary-color)' }} />
          </div>
        </div>

        {/* Realized Revenue */}
        <div style={{ 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #eaedf3', 
          borderRadius: '12px', 
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Realized Revenue
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
            ₹{realizedRevenue.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12.5px', color: '#6b7280', fontWeight: '600' }}>
            <span>{totalVolume > 0 ? Math.round((realizedRevenue / totalVolume) * 100) : 0}% of total volume</span>
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} style={{ color: '#10b981' }} />
          </div>
        </div>

        {/* Pending Settlement */}
        <div style={{ 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #eaedf3', 
          borderRadius: '12px', 
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Settlement
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#f59e0b' }}>
            ₹{pendingSettlement.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12.5px', color: '#6b7280', fontWeight: '600' }}>
            <span>Awaiting payment</span>
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} style={{ color: '#f59e0b' }} />
          </div>
        </div>
      </div>

      {/* Main card covering Tab nav, search pipeline, and invoice table */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #eaedf3', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Tab navigation headers */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #eaedf3', 
          padding: '0 32px',
          alignItems: 'center',
          gap: '24px',
          height: '56px'
        }}>
          <button 
            type="button"
            onClick={() => setActiveTab('ALL')}
            style={{
              height: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '13.5px',
              fontWeight: '700',
              color: activeTab === 'ALL' ? 'var(--primary-color)' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            All History
            {activeTab === 'ALL' && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--primary-color)', borderRadius: '999px' }} />
            )}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('PAID')}
            style={{
              height: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '13.5px',
              fontWeight: '700',
              color: activeTab === 'PAID' ? 'var(--primary-color)' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            Paid
            {activeTab === 'PAID' && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--primary-color)', borderRadius: '999px' }} />
            )}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('UNPAID')}
            style={{
              height: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '13.5px',
              fontWeight: '700',
              color: activeTab === 'UNPAID' ? 'var(--primary-color)' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            Unpaid
            {unpaidCount > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unpaidCount}
              </span>
            )}
            {activeTab === 'UNPAID' && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--primary-color)', borderRadius: '999px' }} />
            )}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('DRAFT')}
            style={{
              height: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '13.5px',
              fontWeight: '700',
              color: activeTab === 'DRAFT' ? 'var(--primary-color)' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            Drafts
            {draftCount > 0 && (
              <span style={{
                backgroundColor: '#9ca3af',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {draftCount}
              </span>
            )}
            {activeTab === 'DRAFT' && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--primary-color)', borderRadius: '999px' }} />
            )}
          </button>
        </div>

        {/* Registry Filter row */}
        <div style={{ 
          padding: '16px 32px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #eaedf3'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
            
            {/* Search Input bar */}
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input 
                type="text" 
                placeholder="Search reference or customer..." 
                style={{ 
                  width: '100%',
                  height: '40px',
                  paddingLeft: '42px', 
                  paddingRight: '16px',
                  border: '1px solid #e2e8f0', 
                  backgroundColor: '#ffffff',
                  color: '#1e3a8a',
                  borderRadius: '8px', 
                  fontSize: '13.5px',
                  fontWeight: '500',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>

            {/* Status filter */}
            <div style={{ position: 'relative', width: '150px' }}>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 32px 0 14px',
                  border: `1px solid ${statusFilter !== 'ALL' ? 'var(--primary-color)' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: statusFilter !== 'ALL' ? 'var(--primary-color)' : '#4b5563',
                  backgroundColor: statusFilter !== 'ALL' ? 'var(--primary-light)' : '#ffffff',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="DRAFT">Draft</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            </div>

            {/* Date range filter */}
            <div style={{ position: 'relative', width: '150px' }}>
              <select 
                value={dateRange}
                onChange={e => {
                  setDateRange(e.target.value);
                  if (e.target.value !== 'CUSTOM') { setStartDate(''); setEndDate(''); }
                }}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 32px 0 14px',
                  border: `1px solid ${dateRange !== 'ALL' ? 'var(--primary-color)' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: dateRange !== 'ALL' ? 'var(--primary-color)' : '#4b5563',
                  backgroundColor: dateRange !== 'ALL' ? 'var(--primary-light)' : '#ffffff',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 3 Months</option>
                <option value="365">Last Year</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            </div>

            {/* Custom date range inputs */}
            {dateRange === 'CUSTOM' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#4b5563',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ color: '#9ca3af', fontWeight: '700', fontSize: '13px' }}>→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#4b5563',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </>
            )}
          </div>

          <div>
            <button 
              type="button"
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--primary-color)',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleExportCSV}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* Data Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '32px' }}>Reference #</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issued By</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Paid</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Balance</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', paddingRight: '32px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => {
              const isPaid = inv.status?.toLowerCase() === 'paid';
              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s ease' }}>
                  
                  {/* Reference # */}
                  <td style={{ padding: '16px 24px', paddingLeft: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={16} style={{ color: 'var(--primary-color)' }} />
                      </div>
                      <span style={{ fontWeight: '700', color: '#111827', fontSize: '14.5px' }}>#{inv.invoice_number}</span>
                    </div>
                  </td>

                  {/* Client Name */}
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                      {clients.find(c => c.id === inv.client_id)?.company_name || 'Unknown Client'}
                    </span>
                  </td>

                  {/* Issued By */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '24px', 
                        height: '24px', 
                        fontSize: '10px', 
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary-color)',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {(inv.user_full_name || 'U')[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '13.5px', color: '#4b5563' }}>{inv.user_full_name || 'User'}</span>
                    </div>
                  </td>

                  {/* Date */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: '13px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                      <Calendar size={14} style={{ color: '#9ca3af' }} />
                      {new Date(inv.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>

                  {/* Total Amount */}
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span style={{ fontWeight: '800', fontSize: '14.5px', color: '#111827' }}>
                      ₹{(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* Paid Amount */}
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span style={{ fontWeight: '600', fontSize: '14.5px', color: '#10b981' }}>
                      ₹{(inv.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* Balance Amount */}
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span style={{ fontWeight: '800', fontSize: '14.5px', color: '#ef4444' }}>
                      ₹{Math.max(0, (inv.total_amount || 0) - (inv.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '16px 24px' }}>
                    {isPaid ? (
                      <div style={{
                        backgroundColor: '#ecfdf5',
                        color: '#10b981',
                        borderRadius: '9999px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        PAID
                      </div>
                    ) : (
                      <div style={{
                        backgroundColor: '#fdf2f2',
                        color: '#ef4444',
                        borderRadius: '9999px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        UNPAID
                      </div>
                    )}
                  </td>

                  {/* Context Sensitive Actions */}
                  <td style={{ padding: '16px 24px', paddingRight: '32px', textAlign: 'right' }}>
                    {isPaid ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {user?.role !== 'admin' && (
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setDuplicateDate(new Date().toISOString().split('T')[0]);
                              setShowDuplicateModal(true);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Duplicate"
                          >
                            <Copy size={15} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleView(inv.id)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Preview"
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDownload(inv.id, inv.invoice_number)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Export PDF"
                        >
                          <Download size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleShare(inv.id, inv.invoice_number)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Share"
                        >
                          <Share2 size={15} />
                        </button>
                        {user?.role !== 'admin' && (
                          <button 
                            type="button"
                            onClick={() => initiateDelete(inv.id)}
                            style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete"
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {user?.role !== 'admin' && (
                          <button 
                            type="button"
                            onClick={() => initiatePayment(inv)}
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: '700',
                              backgroundColor: '#ffffff',
                              color: '#10b981',
                              border: '1px solid #10b981',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#ecfdf5';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                          >
                            Mark Paid
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleView(inv.id)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Preview"
                        >
                          <Eye size={15} />
                        </button>
                        {user?.role !== 'admin' && (
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setDuplicateDate(new Date().toISOString().split('T')[0]);
                              setShowDuplicateModal(true);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="More Options"
                          >
                            <MoreVertical size={16} />
                          </button>
                        )}
                        {user?.role !== 'admin' && (
                          <button 
                            type="button"
                            onClick={() => initiateDelete(inv.id)}
                            style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete"
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredInvoices.length === 0 && (
          <div style={{ padding: '80px', textAlign: 'center' }}>
            <FileText size={48} color="#e2e8f0" style={{ marginBottom: '20px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>No Transactions Recorded</h3>
            <p style={{ fontSize: '13.5px', color: '#6b7280', marginTop: '8px' }}>Adjust your filters or create a new invoice to get started.</p>
          </div>
        )}

        {/* Footer pagination statistics */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #eaedf3',
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
            Showing 1 to {filteredInvoices.length} of {filteredInvoices.length} entries
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button"
              style={{
                padding: '6px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#9ca3af',
                cursor: 'not-allowed'
              }}
              disabled
            >
              Previous
            </button>
            <button 
              type="button"
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--primary-color)',
                border: '1px solid var(--primary-color)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: 'pointer',
                minWidth: '32px'
              }}
            >
              1
            </button>
            <button 
              type="button"
              style={{
                padding: '6px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#9ca3af',
                cursor: 'not-allowed'
              }}
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Overhauled Centered Frosted Preview Modal Dialog */}
      {showPreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#ffffff', width: '95%', maxWidth: '1000px', height: '85vh',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #eaedf3', borderRadius: '12px', display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '20px 28px', 
              borderBottom: '1px solid #eaedf3', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} style={{ color: 'var(--primary-color)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#111827', margin: 0 }}>Invoice Preview</h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>{selectedInv?.invoice_number} | {selectedInv?.company_name}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  type="button"
                  className="btn" 
                  onClick={() => handleDownload(selectedInv?.id, selectedInv?.invoice_number)}
                  style={{ 
                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700',
                    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <Download size={15} /> Download
                </button>
                <button 
                  type="button"
                  className="btn"
                  onClick={() => handleShare(selectedInv?.id, selectedInv?.invoice_number)}
                  style={{ 
                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700',
                    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <Share2 size={15} /> Share
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewUrl(null);
                  }}
                  style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#525659', overflow: 'hidden' }}>
              <iframe 
                src={previewUrl} 
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Invoice Preview Frame"
              />
            </div>
          </div>
        </div>
      )}

      {/* Centered Frosted Duplicate modal */}
      {showDuplicateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ 
            backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #eaedf3', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Copy size={18} style={{ color: 'var(--primary-color)' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0 }}>Duplicate Invoice</h2>
              </div>
              <button 
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                style={{ padding: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '13.5px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
              Duplicating invoice <strong>#{selectedInvoice?.invoice_number}</strong>. Please select a new issue date for the duplicated record.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>New Issue Date</label>
              <input 
                type="date" 
                style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%' }}
                value={duplicateDate} 
                onChange={e => setDuplicateDate(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button"
                style={{
                  flex: 1, padding: '10px 20px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                }}
                onClick={() => setShowDuplicateModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                style={{
                  flex: 1, padding: '10px 20px', backgroundColor: 'var(--primary-color)', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={handleDuplicate}
                disabled={duplicating || !duplicateDate}
              >
                {duplicating ? 'Creating...' : 'Confirm Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#ffffff', width: '400px', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#111827' }}>Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordPayment} style={{ padding: '24px' }}>
              {(() => {
                const outstandingBalance = Math.max(0, (invoiceToPay?.total_amount || 0) - (invoiceToPay?.paid_amount || 0));
                const currentlyPaying = parseFloat(paymentForm.amount) || 0;
                const newBalance = Math.max(0, outstandingBalance - currentlyPaying);

                return (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Outstanding</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>₹{outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ flex: 1, padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', marginBottom: '4px' }}>Paying Now</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>₹{currentlyPaying.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ flex: 1, padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>New Balance</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>₹{newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>Amount (₹)</label>
                <input 
                  type="number" step="0.01" required
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="0.00"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>Payment Method</label>
                <select 
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="ONLINE">Online</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>Notes (Optional)</label>
                <textarea 
                  rows="2"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }}
                  placeholder="Transaction ID, reference, etc."
                />
              </div>
              <button 
                type="submit" 
                disabled={savingPayment}
                style={{
                  width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                  opacity: savingPayment ? 0.7 : 1
                }}
              >
                {savingPayment ? 'Saving...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#ffffff', width: '400px', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden', animation: 'modalSlideUp 0.3s ease-out'
          }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#111827' }}>
                Delete Invoice
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Are you sure you want to delete this invoice? This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setInvoiceToDelete(null);
                    setDeleteConfirmationText('');
                  }}
                  style={{
                    flex: 1, padding: '10px 0', backgroundColor: '#f3f4f6', color: '#4b5563',
                    border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    flex: 1, padding: '10px 0', backgroundColor: '#ef4444', color: '#ffffff',
                    border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Invoices;
