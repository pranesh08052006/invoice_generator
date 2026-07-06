import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  Download, Share2, Plus, Search, ClipboardList, Trash2,
  User, Calendar, CheckCircle, Eye, X, Copy, ChevronDown, MoreVertical, AlertCircle
} from 'lucide-react';

const Quotations = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(location.state?.clientName || '');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, DRAFT, CONVERTED
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedQuot, setSelectedQuot] = useState(null);

  const [converting, setConverting] = useState(false);

  const navigate = useNavigate();

  const fetchQuotations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/quotations`);
      setQuotations(response.data);
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

  useEffect(() => { 
    const loadData = async () => {
      try {
        setLoading(true);
        await fetchQuotations();
        await fetchClients();
      } catch (err) {
        console.error("Failed to load quotation data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDownload = async (id, number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `QT_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert('Failed to download PDF.');
    }
  };

  const handleView = async (id) => {
    try {
      const quot = quotations.find(q => q.id === id);
      setSelectedQuot(quot);
      const response = await axios.get(`${API_BASE_URL}/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      alert('Failed to preview quotation.');
    }
  };

  const handleConvertToInvoice = async (id) => {
    if (!window.confirm("Are you sure you want to convert this Quotation to an Invoice?")) return;
    setConverting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/quotations/${id}/convert`, {});
      alert(`Successfully converted! New Invoice: ${res.data.invoice_number}`);
      fetchQuotations();
    } catch (err) {
      alert(`Failed to convert: ${err.response?.data?.detail || err.message}`);
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this quotation? This action cannot be undone.")) return;
    try {
      await axios.delete(`${API_BASE_URL}/quotations/${id}`);
      fetchQuotations();
    } catch (err) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
    }
  };

  const filteredQuotations = quotations.filter(q => {
    const term = searchTerm.toLowerCase();
    const cName = q.company_name?.toLowerCase() || '';
    const qNum = q.quotation_number.toLowerCase();
    const matchesSearch = cName.includes(term) || qNum.includes(term);
    
    const matchesTab = activeTab === 'ALL' || q.status === activeTab;
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    
    return matchesSearch && matchesTab && matchesStatus;
  });

  const totalVolume = quotations.reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const convertedVolume = quotations.filter(q => q.status === 'CONVERTED').reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const draftVolume = quotations.filter(q => q.status === 'DRAFT').reduce((sum, q) => sum + (q.total_amount || 0), 0);
  
  const draftCount = quotations.filter(q => q.status === 'DRAFT').length;

  if (loading) {
    return (
      <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
        <div className="loading-spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Loading quotations...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            Quotations
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', fontWeight: '500' }}>
            Manage client estimates and convert them to invoices
          </p>
        </div>
        {user?.role !== 'admin' && (
          <button 
            onClick={() => navigate('/quotations/new')}
            style={{
              height: '42px',
              padding: '0 20px',
              backgroundColor: 'var(--primary-color)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
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
            <Plus size={16} /> New Quotation
          </button>
        )}
      </div>

      {/* Grid row of 3 Premium Metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Quoted Volume
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#111827' }}>
            ₹{totalVolume.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={18} style={{ color: 'var(--primary-color)' }} />
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Converted to Invoices
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
            ₹{convertedVolume.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} style={{ color: '#10b981' }} />
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Drafts
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#f59e0b' }}>
            ₹{draftVolume.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} style={{ color: '#f59e0b' }} />
          </div>
        </div>
      </div>

      {/* Main card */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Tab navigation headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eaedf3', padding: '0 32px', backgroundColor: '#fafafa' }}>
          {['ALL', 'DRAFT', 'CONVERTED'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 20px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
                fontSize: '13px',
                fontWeight: activeTab === tab ? '700' : '600',
                color: activeTab === tab ? 'var(--primary-color)' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {tab === 'ALL' ? 'All Quotes' : tab === 'DRAFT' ? 'Drafts' : 'Converted'}
              {tab === 'DRAFT' && draftCount > 0 && (
                <span style={{ backgroundColor: '#9ca3af', color: '#ffffff', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px' }}>
                  {draftCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaedf3' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input 
                type="text" 
                placeholder="Search reference or customer..." 
                style={{ width: '100%', height: '40px', paddingLeft: '42px', paddingRight: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13.5px', fontWeight: '500', outline: 'none' }}
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <div style={{ position: 'relative', width: '150px' }}>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: '100%', height: '40px', padding: '0 32px 0 14px', border: `1px solid ${statusFilter !== 'ALL' ? 'var(--primary-color)' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: statusFilter !== 'ALL' ? 'var(--primary-color)' : '#4b5563', backgroundColor: statusFilter !== 'ALL' ? 'var(--primary-light)' : '#ffffff', appearance: 'none', outline: 'none', cursor: 'pointer' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="CONVERTED">Converted</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
                <th style={{ padding: '16px 32px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotation</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 32px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 32px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ClipboardList size={32} style={{ color: '#94a3b8' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>No quotations found</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Create a new estimate to get started.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #eaedf3', transition: 'background-color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ClipboardList size={18} style={{ color: 'var(--primary-color)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{q.quotation_number}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={14} style={{ color: '#9ca3af' }} />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>{q.company_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4b5563', fontWeight: '500' }}>
                          <Calendar size={13} style={{ color: '#9ca3af' }} /> {new Date(q.date).toLocaleDateString('en-GB')}
                        </div>
                        {q.valid_until && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>
                            Valid till: {new Date(q.valid_until).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827' }}>
                        ₹{(q.total_amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700',
                        backgroundColor: q.status === 'CONVERTED' ? '#ecfdf5' : '#f3f4f6',
                        color: q.status === 'CONVERTED' ? '#10b981' : '#4b5563'
                      }}>
                        {q.status === 'CONVERTED' && <CheckCircle size={14} />}
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 32px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => handleView(q.id)} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}>
                          <Eye size={14} /> View
                        </button>
                        <button onClick={() => handleDownload(q.id, q.quotation_number)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                          <Download size={15} />
                        </button>
                        {q.status !== 'CONVERTED' && user?.role !== 'admin' && (
                          <button 
                            onClick={() => handleConvertToInvoice(q.id)} 
                            disabled={converting}
                            style={{ 
                              padding: '6px 10px', backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary-color)', 
                              borderRadius: '6px', color: 'var(--primary-color)', fontSize: '13px', fontWeight: '600', 
                              cursor: converting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' 
                            }} 
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.color = '#ffffff'; }} 
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary-color)'; }}>
                            <CheckCircle size={14} /> Convert
                          </button>
                        )}
                        {user?.role !== 'admin' && (
                          <button onClick={() => handleDelete(q.id)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && selectedQuot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '1000px', height: '100%', maxHeight: '90vh', backgroundColor: '#ffffff', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={16} style={{ color: 'var(--primary-color)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Quotation: {selectedQuot.quotation_number}</h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Preview Document</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => handleDownload(selectedQuot.id, selectedQuot.quotation_number)} style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => setShowPreview(false)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#f1f5f9', padding: '24px' }}>
              <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} title="Quotation PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
