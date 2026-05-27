import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

import { Search, Plus, Phone, MessageSquare, Hash, X, MapPin, Edit3, Trash2, User, ChevronDown, Layout, Eye, Download, Share2, FileText } from 'lucide-react';

const Clients = ({ user, company }) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [transactionTab, setTransactionTab] = useState('INVOICES'); // INVOICES, QUOTATIONS, PROFORMA
  const [showModal, setShowModal] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);
  
  const [newClient, setNewClient] = useState({ 
    company_name: '', contact_person: '', mobile: '', whatsapp: '', 
    email: '', address: '', shipping_address: '', gst_number: '', state: '' 
  });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);

  const handleDownload = async (id, number, type = 'INVOICE') => {
    try {
      const endpoint = type === 'QUOTATION' ? 'quotations' : type === 'PROFORMA' ? 'proformas' : 'invoices';
      const prefix = type === 'QUOTATION' ? 'QT' : type === 'PROFORMA' ? 'PI' : 'INV';
      const response = await axios.get(`${API_BASE_URL}/${endpoint}/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${prefix}_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert('Failed to download PDF.');
    }
  };

  const handleView = async (id, type = 'INVOICE') => {
    try {
      const endpoint = type === 'QUOTATION' ? 'quotations' : type === 'PROFORMA' ? 'proformas' : 'invoices';
      const docList = type === 'QUOTATION' ? quotations : type === 'PROFORMA' ? proformas : invoices;
      const doc = docList.find(i => i.id === id);
      setSelectedInv(doc);
      const response = await axios.get(`${API_BASE_URL}/${endpoint}/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      alert('Failed to preview document.');
    }
  };

  const handleShare = async (id, number, type = 'INVOICE') => {
    try {
      const endpoint = type === 'QUOTATION' ? 'quotations' : type === 'PROFORMA' ? 'proformas' : 'invoices';
      const prefix = type === 'QUOTATION' ? 'QT' : type === 'PROFORMA' ? 'PI' : 'INV';
      const response = await axios.get(`${API_BASE_URL}/${endpoint}/${id}/pdf`, { responseType: 'blob' });
      const file = new File([response.data], `${prefix}_${number}.pdf`, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: `${prefix} ${number}` });
      } else {
        alert('Share not supported on this browser.');
      }
    } catch (err) {
      alert('Failed to share.');
    }
  };

  const sendReminder = (client, balance) => {
    const phoneNumber = client.whatsapp || client.mobile;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    
    const companyName = company?.name || 'our company';
    const message = `Dear ${client.company_name},\n\nThis is a friendly reminder regarding your outstanding balance of *₹${balance.toLocaleString()}* with *${companyName}*.\n\nPlease settle this at your earliest convenience. If you have already made the payment, please ignore this message.\n\nThank you!`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
  };

  const fetchClients = async () => {
    try {
      const [cRes, iRes, qRes, pRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/clients`),
        axios.get(`${API_BASE_URL}/invoices`),
        axios.get(`${API_BASE_URL}/quotations`),
        axios.get(`${API_BASE_URL}/proformas`)
      ]);
      setClients(cRes.data);
      setInvoices(iRes.data);
      setQuotations(qRes.data);
      setProformas(pRes.data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const exportClientStatementCSV = (client, docs, type = 'INVOICES') => {
    const numKey = type === 'QUOTATIONS' ? 'quotation_number' : type === 'PROFORMA' ? 'proforma_number' : 'invoice_number';
    const label = type.charAt(0) + type.slice(1).toLowerCase();
    
    const headers = [`${label} Number`, "Date", "Status", "Total Amount (INR)"];
    if (type === 'INVOICES') {
      headers.push("Paid Amount (INR)", "Balance Due (INR)");
    }

    const rows = docs.map(doc => {
      const row = [
        doc[numKey],
        new Date(doc.date).toLocaleDateString(),
        doc.status || (type === 'INVOICES' ? 'UNPAID' : 'DRAFT'),
        doc.total_amount || 0
      ];
      if (type === 'INVOICES') {
        row.push(doc.paid_amount || 0);
        row.push((doc.total_amount || 0) - (doc.paid_amount || 0));
      }
      return row;
    });
    
    const totalVolume = docs.reduce((sum, doc) => sum + (doc.total_amount || 0), 0);
    rows.push([]);
    rows.push([`Total ${label} Volume`, totalVolume]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${client.company_name.replace(/\s+/g, '_')}_${label}_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportClientStatementPDF = (client, docs, type = 'INVOICES') => {
    const printWindow = window.open('', '_blank');
    const numKey = type === 'QUOTATIONS' ? 'quotation_number' : type === 'PROFORMA' ? 'proforma_number' : 'invoice_number';
    const label = type.charAt(0) + type.slice(1).toLowerCase();
    const totalVolume = docs.reduce((sum, doc) => sum + (doc.total_amount || 0), 0);

    const html = `
      <html>
        <head>
          <title>${label} Statement - ${client.company_name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111827; padding: 40px; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #eaedf3; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #1e3a8a; }
            .client-info { font-size: 14px; color: #4b5563; line-height: 1.5; }
            .stats { display: flex; gap: 20px; margin-bottom: 40px; }
            .stat-card { padding: 16px; background-color: #f8fafc; border: 1px solid #eaedf3; border-radius: 8px; flex: 1; }
            .stat-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
            .stat-value { font-size: 18px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { padding: 12px 16px; font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; background-color: #f8fafc; border-bottom: 1px solid #eaedf3; }
            td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .text-right { text-align: right; }
            .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
            .badge-success { background-color: #dcfce7; color: #16a34a; }
            .badge-neutral { background-color: #f3f4f6; color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${label.toUpperCase()} STATEMENT</div>
              <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Generated on ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="client-info" style="text-align: right;">
              <strong>${client.company_name}</strong><br/>
              ${client.mobile}<br/>
              ${client.email || ''}<br/>
              ${client.address || ''}
            </div>
          </div>

          <div class="stats">
            <div class="stat-card">
              <span class="stat-label">Total ${label} Volume</span>
              <div class="stat-value" style="color: #111827;">₹${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${label} Number</th>
                <th>Date</th>
                <th>Status</th>
                <th class="text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${docs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(doc => `
                <tr>
                  <td><strong>${doc[numKey]}</strong></td>
                  <td>${new Date(doc.date).toLocaleDateString()}</td>
                  <td>
                    <span class="badge ${doc.status?.toUpperCase() === 'PAID' || doc.status?.toUpperCase() === 'CONVERTED' ? 'badge-success' : 'badge-neutral'}">
                      ${doc.status || 'DRAFT'}
                    </span>
                  </td>
                  <td class="text-right">₹${(doc.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => { 
    fetchClients(); 
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newClient };
      if (whatsappSameAsPhone) payload.whatsapp = payload.mobile;
      
      if (editingId) {
        await axios.put(`${API_BASE_URL}/clients/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/clients`, payload);
      }
      
      closeModal();
      fetchClients();
    } catch (err) {
      alert('Error saving client. Check if all fields are valid.');
    }
  };

  const handleEdit = (client) => {
    setEditingId(client.id);
    setNewClient({
      company_name: client.company_name || '',
      contact_person: client.contact_person || '',
      mobile: client.mobile || '',
      whatsapp: client.whatsapp || '',
      email: client.email || '',
      address: client.address || '',
      shipping_address: client.shipping_address || '',
      gst_number: client.gst_number || '',
      state: client.state || ''
    });
    setWhatsappSameAsPhone(client.whatsapp === client.mobile);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/clients/${id}`);
      fetchClients();
    } catch (err) {
      alert('Error deleting client');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setNewClient({ 
      company_name: '', contact_person: '', mobile: '', whatsapp: '', 
      email: '', address: '', shipping_address: '', gst_number: '', state: '' 
    });
    setWhatsappSameAsPhone(true);
  };

  const getClientBalance = (client) => {
    const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
    return clientInvoices.reduce((sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0);
  };

  const filtered = clients
    .filter(c => {
      const matchesSearch =
        (c.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.mobile || '').includes(searchTerm) ||
        (c.gst_number || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'WITH_BALANCE') return getClientBalance(c) > 0;
      if (statusFilter === 'CLEARED') return getClientBalance(c) <= 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'name_asc') return (a.company_name || '').localeCompare(b.company_name || '');
      if (sortBy === 'name_desc') return (b.company_name || '').localeCompare(a.company_name || '');
      if (sortBy === 'balance_desc') return getClientBalance(b) - getClientBalance(a);
      return 0;
    });

  return (
    <>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Redesigned Premium Title Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
            Customers
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Manage your client registry, contact details, and tax information.
          </p>
        </div>
        <button 
          type="button"
          onClick={() => setShowModal(true)} 
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
          <Plus size={16} /> Add New Customer
        </button>
      </div>

      {/* Redesigned Premium Search & Filter Bar */}
      <div style={{ 
        padding: '16px 24px', 
        display: 'flex', 
        gap: '16px', 
        alignItems: 'center', 
        backgroundColor: '#ffffff',
        border: '1px solid #eaedf3',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
      }}>
        {/* Search Field */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search customers by name, phone, or GST..." 
            style={{ 
              width: '100%',
              height: '42px',
              paddingLeft: '42px', 
              paddingRight: '16px',
              border: '1px solid #e2e8f0', 
              backgroundColor: 'var(--primary-light)',
              color: '#1e3a8a',
              borderRadius: '8px', 
              fontSize: '14px',
              fontWeight: '500',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--primary-color)';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.backgroundColor = 'var(--primary-light)';
            }}
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* Muted Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

        {/* Balance status filter */}
        <div style={{ position: 'relative', width: '160px' }}>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
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
            <option value="ALL">All Customers</option>
            <option value="WITH_BALANCE">Has Balance Due</option>
            <option value="CLEARED">Fully Cleared</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
        </div>

        {/* Sort dropdown */}
        <div style={{ position: 'relative', width: '180px' }}>
          <select 
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 32px 0 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#4b5563',
              backgroundColor: '#ffffff',
              appearance: 'none',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="name_asc">Sort: Name A→Z</option>
            <option value="name_desc">Sort: Name Z→A</option>
            <option value="balance_desc">Sort: Balance (Highest First)</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Redesigned Premium Registry Table Grid Container */}
      <div className="card" style={{ padding: '0', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '24%', paddingLeft: '32px' }}>Client Entity</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Contact Info</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '13%' }}>Total Billed</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Outstanding Balance</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '13%' }}>Taxation</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%' }}>Location</th>
              <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'right', paddingRight: '32px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const isCorporate = !!c.gst_number;
              const clientInvoices = invoices.filter(inv => inv.client_id === c.id);
              const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
              const totalPaid = clientInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
              const outstandingBalance = totalInvoiced - totalPaid;
              return (
                <tr 
                  key={c.id} 
                  onClick={() => setViewingClient(c)}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s ease', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Client Entity details */}
                  <td style={{ padding: '16px 24px', paddingLeft: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {c.company_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '700', color: '#111827', fontSize: '14.5px' }}>{c.company_name}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginTop: '2px' }}>
                          {isCorporate ? 'Corporate' : 'Individual'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Contact details */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '13px', fontWeight: '600' }}>
                        <Phone size={13} style={{ color: '#9ca3af' }} />
                        <span>{c.mobile || 'No contact'}</span>
                      </div>
                      {c.whatsapp && c.whatsapp !== c.mobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
                          <MessageSquare size={13} style={{ color: '#16a34a' }} />
                          <span>{c.whatsapp}</span>
                        </div>
                      )}
                      {c.whatsapp && c.whatsapp === c.mobile && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', paddingLeft: '21px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                          WhatsApp Active
                        </span>
                      )}
                      {c.email && (
                        <span style={{ fontSize: '12px', color: '#6b7280', paddingLeft: '21px' }}>{c.email}</span>
                      )}
                    </div>
                  </td>

                  {/* Total Billed Column */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ 
                        fontWeight: '700', 
                        color: '#111827', 
                        fontSize: '14px' 
                      }}>
                        ₹{totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                        Total Billed
                      </span>
                    </div>
                  </td>

                  {/* Outstanding Balance Column */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ 
                        fontWeight: '800', 
                        color: outstandingBalance > 0 ? '#b91c1c' : '#16a34a', 
                        fontSize: '14.5px' 
                      }}>
                        ₹{outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                        {outstandingBalance > 0 ? 'Payment Pending' : 'Clear Balance'}
                      </span>
                    </div>
                  </td>

                  {/* Taxation Status Badge */}
                  <td style={{ padding: '16px 24px' }}>
                    {c.gst_number ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary-color)',
                          borderRadius: '9999px',
                          padding: '4px 12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontFamily: 'monospace',
                          width: 'fit-content'
                        }}>
                          GST: {c.gst_number}
                        </div>
                        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500', marginLeft: '4px' }}>Registered</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{
                          backgroundColor: '#f1f5f9',
                          color: '#6b7280',
                          borderRadius: '9999px',
                          padding: '4px 12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          width: 'fit-content'
                        }}>
                          Unregistered GST
                        </div>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500', marginLeft: '4px' }}>Individual</span>
                      </div>
                    )}
                  </td>

                  {/* State Location details */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '13px', fontWeight: '500' }}>
                      <MapPin size={14} style={{ color: '#9ca3af' }} />
                      <span>{c.state || 'N/A'}</span>
                    </div>
                  </td>

                  {/* Actions Column */}
                  <td style={{ padding: '16px 24px', paddingRight: '32px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {outstandingBalance > 0 && (
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); sendReminder(c, outstandingBalance); }}
                          title="Send Payment Reminder"
                          style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#16a34a',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#dcfce7';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <MessageSquare size={15} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#4b5563',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                          e.currentTarget.style.color = 'var(--primary-color)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#4b5563';
                        }}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                          opacity: 0.8
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.opacity = '0.8';
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer Pagination bar */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #eaedf3',
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
            Showing 1 to {filtered.length} of {filtered.length} entries
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

      {/* Overhauled Centered Slide Panel Drawer Overlay */}
      {showModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            zIndex: 9999
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            backgroundColor: '#ffffff', height: '100%', width: '100%', maxWidth: '580px',
            boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1), -5px 0 10px -5px rgba(0, 0, 0, 0.04)',
            borderLeft: '1px solid #eaedf3', display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out'
          }}>
            
            {/* Header */}
            <div style={{ 
               padding: '24px 32px', 
               borderBottom: '1px solid #eaedf3', 
               display: 'flex', 
               justifyContent: 'space-between', 
               alignItems: 'center',
               backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} style={{ color: 'var(--primary-color)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
                    {editingId ? 'Edit Customer' : 'New Customer'}
                  </h2>
                </div>
              </div>
              <button 
                onClick={closeModal} 
                style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body without browser scrollbar */}
            <div className="no-scrollbar" style={{ padding: '32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <form onSubmit={handleSubmit} id="customer-form" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Section 1: Entity Profile */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '16px' }}>Identity & Profile</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Company Name *</label>
                      <input 
                        placeholder="Legal Entity Name" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.company_name} 
                        onChange={e => setNewClient({...newClient, company_name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Contact Person</label>
                      <input 
                        placeholder="Primary Contact Name" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.contact_person} 
                        onChange={e => setNewClient({...newClient, contact_person: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '16px' }}>Communication & Taxation</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Phone Number *</label>
                      <input 
                        placeholder="+91..." 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.mobile} 
                        onChange={e => {
                          const val = e.target.value;
                          setNewClient(prev => ({
                            ...prev,
                            mobile: val,
                            whatsapp: whatsappSameAsPhone ? val : prev.whatsapp
                          }));
                        }}
                        required 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>WhatsApp Number</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={whatsappSameAsPhone}
                            onChange={e => {
                              const checked = e.target.checked;
                              setWhatsappSameAsPhone(checked);
                              if (checked) {
                                setNewClient(prev => ({ ...prev, whatsapp: prev.mobile }));
                              }
                            }}
                            style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                          />
                          Same as Phone
                        </label>
                      </div>
                      <input 
                        placeholder={whatsappSameAsPhone ? "Same as phone number" : "+91..."} 
                        style={{ 
                          height: '42px', 
                          padding: '10px 14px', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          fontSize: '14px', 
                          outline: 'none',
                          backgroundColor: whatsappSameAsPhone ? '#f8fafc' : '#ffffff',
                          color: whatsappSameAsPhone ? '#6b7280' : '#111827'
                        }}
                        value={whatsappSameAsPhone ? newClient.mobile : newClient.whatsapp} 
                        onChange={e => setNewClient({...newClient, whatsapp: e.target.value})} 
                        disabled={whatsappSameAsPhone}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email Address</label>
                      <input 
                        placeholder="billing@client.com" 
                        type="email"
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.email} 
                        onChange={e => setNewClient({...newClient, email: e.target.value})} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>GST Number</label>
                      <input 
                        placeholder="Optional GSTIN" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.gst_number} 
                        onChange={e => setNewClient({...newClient, gst_number: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>State *</label>
                      <input 
                        placeholder="e.g. Maharashtra" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.state} 
                        onChange={e => setNewClient({...newClient, state: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Location */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '16px' }}>Addresses</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Billing Address</label>
                      <textarea 
                        placeholder="Billing address details" 
                        style={{ height: '70px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'none' }}
                        value={newClient.address} 
                        onChange={e => {
                          const val = e.target.value;
                          setNewClient(prev => ({
                            ...prev,
                            address: val,
                            shipping_address: shippingSameAsBilling ? val : prev.shipping_address
                          }));
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Shipping Address</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={shippingSameAsBilling}
                            onChange={e => {
                              const checked = e.target.checked;
                              setShippingSameAsBilling(checked);
                              if (checked) {
                                setNewClient(prev => ({ ...prev, shipping_address: prev.address }));
                              }
                            }}
                            style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                          />
                          Same as Billing
                        </label>
                      </div>
                      <textarea 
                        placeholder={shippingSameAsBilling ? "Same as billing address" : "Shipping address details"} 
                        style={{ 
                          height: '70px', 
                          padding: '10px 14px', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          fontSize: '14px', 
                          outline: 'none', 
                          resize: 'none',
                          backgroundColor: shippingSameAsBilling ? '#f8fafc' : '#ffffff',
                          color: shippingSameAsBilling ? '#6b7280' : '#111827'
                        }}
                        value={shippingSameAsBilling ? newClient.address : newClient.shipping_address} 
                        onChange={e => setNewClient({...newClient, shipping_address: e.target.value})} 
                        disabled={shippingSameAsBilling}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Live Preview details */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, var(--primary-light) 100%)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Customer Preview</div>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newClient.company_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Phone</div>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{newClient.mobile || '—'}</div>
                  </div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '20px 32px', 
              borderTop: '1px solid #eaedf3', 
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                type="button" 
                style={{
                  padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                }} 
                onClick={closeModal}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="customer-form" 
                style={{
                  padding: '8px 28px', backgroundColor: 'var(--primary-color)', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                {editingId ? 'Update Record' : 'Save Customer'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Client Details Drawer */}
      {viewingClient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 100, display: 'flex', justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '600px', backgroundColor: '#ffffff', height: '100vh',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ 
              padding: '24px 32px', borderBottom: '1px solid #eaedf3', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em' }}>
                  {viewingClient.company_name}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                  Client Activity & Summary
                </p>
              </div>
              <button 
                onClick={() => setViewingClient(null)}
                style={{
                  border: 'none', background: '#f1f5f9', color: '#6b7280', width: '32px', height: '32px', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
              
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {(() => {
                  const clientInvoices = invoices.filter(inv => inv.client_id === viewingClient.id);
                  const totalRevenue = clientInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                  const totalPaid = clientInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
                  const balance = totalRevenue - totalPaid;
                  
                  return (
                    <>
                      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #eaedf3' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</span>
                        <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#111827' }}>₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Balance</span>
                        <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#ef4444' }}>₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Received</span>
                        <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#16a34a' }}>₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Invoices List Header with Export actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Transaction History</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      let activeDocs = [];
                      if (transactionTab === 'INVOICES') activeDocs = invoices.filter(inv => inv.client_id === viewingClient.id);
                      else if (transactionTab === 'QUOTATIONS') activeDocs = quotations.filter(q => q.client_id === viewingClient.id);
                      else if (transactionTab === 'PROFORMA') activeDocs = proformas.filter(p => p.client_id === viewingClient.id);
                      exportClientStatementCSV(viewingClient, activeDocs, transactionTab);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <Download size={12} /> CSV
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      let activeDocs = [];
                      if (transactionTab === 'INVOICES') activeDocs = invoices.filter(inv => inv.client_id === viewingClient.id);
                      else if (transactionTab === 'QUOTATIONS') activeDocs = quotations.filter(q => q.client_id === viewingClient.id);
                      else if (transactionTab === 'PROFORMA') activeDocs = proformas.filter(p => p.client_id === viewingClient.id);
                      exportClientStatementPDF(viewingClient, activeDocs, transactionTab);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <FileText size={12} /> Statement PDF
                  </button>
                </div>
              </div>

              {/* Transaction Tab Navigation */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #eaedf3' }}>
                {['INVOICES', 'QUOTATIONS', 'PROFORMA'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTransactionTab(tab)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: transactionTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: transactionTab === tab ? 'var(--primary-color)' : '#9ca3af',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}s
                  </button>
                ))}
              </div>
              
              <div style={{ border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Ref #</th>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let activeDocs = [];
                      if (transactionTab === 'INVOICES') activeDocs = invoices.filter(inv => inv.client_id === viewingClient.id);
                      else if (transactionTab === 'QUOTATIONS') activeDocs = quotations.filter(q => q.client_id === viewingClient.id);
                      else if (transactionTab === 'PROFORMA') activeDocs = proformas.filter(p => p.client_id === viewingClient.id);

                      if (activeDocs.length === 0) {
                        return <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>No {transactionTab.toLowerCase()}s found for this customer.</td></tr>;
                      }

                      return activeDocs
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(doc => {
                          const docNumber = doc.invoice_number || doc.quotation_number || doc.proforma_number;
                          return (
                            <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#111827' }}>{docNumber}</td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                                {new Date(doc.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ 
                                  padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: '700',
                                  backgroundColor: doc.status?.toUpperCase() === 'PAID' || doc.status?.toUpperCase() === 'CONVERTED' ? '#dcfce7' : '#fee2e2',
                                  color: doc.status?.toUpperCase() === 'PAID' || doc.status?.toUpperCase() === 'CONVERTED' ? '#16a34a' : '#ef4444'
                                }}>
                                  {doc.status || 'UNPAID'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', textAlign: 'right', color: '#111827' }}>
                                ₹{(doc.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button type="button" onClick={() => handleView(doc.id, transactionTab.slice(0, -1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }} title="View"><Eye size={14} /></button>
                                  <button type="button" onClick={() => handleDownload(doc.id, docNumber, transactionTab.slice(0, -1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }} title="Download PDF"><Download size={14} /></button>
                                  <button type="button" onClick={() => handleShare(doc.id, docNumber, transactionTab.slice(0, -1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }} title="Share PDF"><Share2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>{selectedInv?.invoice_number} | {selectedInv?.company_name || viewingClient?.company_name}</p>
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
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default Clients;
