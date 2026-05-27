import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  Building2, MapPin, Hash, Phone, Save, Mail, 
  CreditCard, Landmark, Upload, CheckCircle2, X, Edit3, ShieldCheck, User,
  Palette, RotateCcw
} from 'lucide-react';

const SettingsPage = ({ fetchCompanyGlobal }) => {
  const navigate = useNavigate();
  const [company, setCompany] = useState({
    name: '',
    address: '',
    gst_number: '',
    mobile: '',
    email: '',
    bank_name: '',
    account_no: '',
    ifsc: '',
    account_type: 'Current',
    account_holder_name: '',
    upi_id: '',
    primary_color: '#2563eb',
    secondary_color: '#ffffff',
    signature_url: '',
    logo_url: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Cache buster timestamps to force reload new uploads
  const [logoCacheBuster, setLogoCacheBuster] = useState(Date.now());
  const [sigCacheBuster, setSigCacheBuster] = useState(Date.now());

  useEffect(() => {
    fetchCompany();
  }, []);

  useEffect(() => {
    const primary = company.primary_color || '#2563eb';
    const secondary = company.secondary_color || '#ffffff';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);

    let r = 37, g = 99, b = 235;
    if (primary.startsWith('#')) {
      const hex = primary.replace('#', '');
      if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    }
    document.documentElement.style.setProperty('--primary-light', `rgba(${r}, ${g}, ${b}, 0.1)`);
    document.documentElement.style.setProperty('--primary-hover', `rgba(${r}, ${g}, ${b}, 0.85)`);
  }, [company.primary_color, company.secondary_color]);

  const fetchCompany = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/company`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setCompany(response.data);
      }
    } catch (err) {
      console.error("Error fetching company:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'logo' ? 'logo' : 'signature';
      const response = await axios.post(`${API_BASE_URL}/company/${endpoint}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (type === 'logo') {
        setCompany({ ...company, logo_url: response.data.logo_url });
        setLogoCacheBuster(Date.now());
      } else {
        setCompany({ ...company, signature_url: response.data.signature_url });
        setSigCacheBuster(Date.now());
      }
      if (fetchCompanyGlobal) fetchCompanyGlobal();
    } catch (err) {
      alert(`Failed to upload ${type}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const { id, user_id, _id, ...profileData } = company;
      await axios.post(`${API_BASE_URL}/company`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (fetchCompanyGlobal) fetchCompanyGlobal();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      alert("Error saving company details");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: '#6b7280', fontSize: '14px', fontWeight: '600' }}>
        Loading business preferences...
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
      
      {/* Title Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
            Business Settings
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Manage your company profile, financial details, and application preferences.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '13.5px',
              fontWeight: '700',
              color: '#4b5563',
              cursor: 'pointer'
            }}
          >
            Discard
          </button>
          <button 
            type="button"
            onClick={handleSave} 
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
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {/* Two Column Business Grid Container */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.4fr 1fr', 
        gap: '32px', 
        maxWidth: '1280px',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Core Identity & Identity Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Card 1: Core Identity */}
          <div style={{ 
            backgroundColor: 'var(--secondary-color)', 
            border: '1px solid #eaedf3', 
            borderRadius: '12px', 
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#111827', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <Building2 size={18} style={{ color: 'var(--primary-color)' }} />
              Core Identity
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Business Name</label>
                <input 
                  type="text" 
                  style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                  value={company.name} 
                  onChange={e => setCompany({...company, name: e.target.value})} 
                  placeholder="Justry"
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Registered Address</label>
                <textarea 
                  style={{ minHeight: '110px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontFamily: 'inherit', resize: 'vertical', lineHeight: '1.5', fontWeight: '500' }}
                  value={company.address} 
                  onChange={e => setCompany({...company, address: e.target.value})} 
                  placeholder="Coimbatore, Tamil Nadu, India"
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Support Contact</label>
                  <input 
                    type="text" 
                    style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.mobile} 
                    onChange={e => setCompany({...company, mobile: e.target.value})} 
                    placeholder="9876543210"
                    required 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Support Email</label>
                  <input 
                    type="email" 
                    style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.email || ''} 
                    onChange={e => setCompany({...company, email: e.target.value})} 
                    placeholder="support@justry.in"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>GSTIN</label>
                <input 
                  type="text" 
                  style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                  value={company.gst_number || ''} 
                  onChange={e => setCompany({...company, gst_number: e.target.value})} 
                  placeholder="33AAAAA0000A1Z5"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Identity Branding */}
          <div style={{ 
            backgroundColor: 'var(--secondary-color)', 
            border: '1px solid #eaedf3', 
            borderRadius: '12px', 
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#111827', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <Upload size={18} style={{ color: 'var(--primary-color)' }} />
              Identity Branding
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Logo Drag Drop */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Company Logo</label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer'
                }}>
                  {company.logo_url ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <img src={`${company.logo_url}?t=${logoCacheBuster}`} alt="Logo" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                      <label style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                        Change Logo
                        <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'logo')} hidden />
                      </label>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={18} style={{ color: 'var(--primary-color)' }} />
                      </div>
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>Click to upload Logo</span>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>SVG, PNG, JPG (max. 800x400px)</span>
                      <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'logo')} hidden />
                    </label>
                  )}
                </div>
              </div>

              {/* Signature Drag Drop */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Authorized Signature</label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer'
                }}>
                  {company.signature_url ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <img src={`${company.signature_url}?t=${sigCacheBuster}`} alt="Signature" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', filter: 'contrast(1.2)' }} />
                      <label style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                        Change Signature
                        <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'signature')} hidden />
                      </label>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit3 size={16} style={{ color: 'var(--primary-color)' }} />
                      </div>
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>Click to upload Signature</span>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>PNG transparent (max. 400x200px)</span>
                      <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'signature')} hidden />
                    </label>
                  )}
                </div>
              </div>
            </div>
            {uploading && (
              <p style={{ fontSize: '11.5px', color: 'var(--primary-color)', fontWeight: '700', margin: '4px 0 0 0', textAlign: 'center', letterSpacing: '0.05em' }}>
                SYNCING MEDIA ASSETS...
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Financial Settlement & Preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Card 3: Financial Settlement */}
          <div style={{ 
            backgroundColor: 'var(--secondary-color)', 
            border: '1px solid #eaedf3', 
            borderRadius: '12px', 
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#111827', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <Landmark size={18} style={{ color: 'var(--primary-color)' }} />
              Financial Settlement
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Bank Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Landmark size={14} style={{ position: 'absolute', left: '14px', color: '#9ca3af' }} />
                  <input 
                    type="text" 
                    style={{ height: '42px', width: '100%', paddingLeft: '40px', paddingRight: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.bank_name || ''} 
                    onChange={e => setCompany({...company, bank_name: e.target.value})} 
                    placeholder="HDFC Bank"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Account Number</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <CreditCard size={14} style={{ position: 'absolute', left: '14px', color: '#9ca3af' }} />
                  <input 
                    type="text" 
                    style={{ height: '42px', width: '100%', paddingLeft: '40px', paddingRight: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.account_no || ''} 
                    onChange={e => setCompany({...company, account_no: e.target.value})} 
                    placeholder="•••• •••• •••• 1234"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>IFSC Code</label>
                  <input 
                    type="text" 
                    style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.ifsc || ''} 
                    onChange={e => setCompany({...company, ifsc: e.target.value})} 
                    placeholder="HDFC0001234"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Account Type</label>
                  <select 
                    style={{ height: '42px', padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13.5px', outline: 'none', backgroundColor: '#ffffff', color: '#111827', fontWeight: '600', cursor: 'pointer' }}
                    value={company.account_type || 'Current'}
                    onChange={e => setCompany({...company, account_type: e.target.value})}
                  >
                    <option value="Current">Current Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Salary">Salary Account</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Account Holder Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={14} style={{ position: 'absolute', left: '14px', color: '#9ca3af' }} />
                  <input 
                    type="text" 
                    style={{ height: '42px', width: '100%', paddingLeft: '40px', paddingRight: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500' }}
                    value={company.account_holder_name || ''} 
                    onChange={e => setCompany({...company, account_holder_name: e.target.value})}
                    placeholder="E.g. Justry Technologies"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>UPI ID / GPay Number</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Edit3 size={14} style={{ position: 'absolute', left: '14px', color: '#9ca3af' }} />
                  <input 
                    type="text" 
                    style={{ height: '42px', width: '100%', paddingLeft: '40px', paddingRight: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#111827', fontWeight: '500', backgroundColor: '#fdfcfe' }}
                    value={company.upi_id || ''} 
                    onChange={e => setCompany({...company, upi_id: e.target.value})}
                    placeholder="e.g. name@upi or 9876543210"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: UI Custom Branding */}
          <div style={{ 
            backgroundColor: 'var(--secondary-color)', 
            border: '1px solid #eaedf3', 
            borderRadius: '12px', 
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#111827', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <Palette size={18} style={{ color: 'var(--primary-color)' }} />
              UI Custom Branding
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Color Panel 1: Primary Accent Color */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Primary Theme Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', width: '56px', height: '42px', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer' }}>
                    <input 
                      type="color" 
                      style={{ position: 'absolute', top: '-6px', left: '-6px', width: '68px', height: '54px', border: 'none', padding: 0, cursor: 'pointer' }}
                      value={company.primary_color || '#2563eb'} 
                      onChange={e => setCompany({...company, primary_color: e.target.value})} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827', fontFamily: 'monospace' }}>{(company.primary_color || '#2563eb').toUpperCase()}</span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Accents, buttons, and highlights</span>
                  </div>
                </div>
              </div>

              {/* Color Panel 2: Secondary Background Color */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Secondary Card Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', width: '56px', height: '42px', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer' }}>
                    <input 
                      type="color" 
                      style={{ position: 'absolute', top: '-6px', left: '-6px', width: '68px', height: '54px', border: 'none', padding: 0, cursor: 'pointer' }}
                      value={company.secondary_color || '#ffffff'} 
                      onChange={e => setCompany({...company, secondary_color: e.target.value})} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827', fontFamily: 'monospace' }}>{(company.secondary_color || '#ffffff').toUpperCase()}</span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Card backgrounds and headers</span>
                  </div>
                </div>
              </div>

              {/* Default Theme Button Option */}
              <button
                type="button"
                onClick={() => setCompany({
                  ...company,
                  primary_color: '#2563eb',
                  secondary_color: '#ffffff'
                })}
                style={{
                  height: '42px',
                  width: '100%',
                  marginTop: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <RotateCcw size={14} />
                Reset to Default (Blue & White)
              </button>

            </div>
          </div>


        </div>
      </div>

      {/* Styled Charcoal Absolute Toast Notification */}
      {saved && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#111827',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 99999,
          animation: 'slideInUp 0.2s ease-out',
          width: '360px',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#ffffff' }}>Settings Saved Successfully</span>
              <span style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>Your business profile has been updated.</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setSaved(false)}
            style={{ border: 'none', backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
