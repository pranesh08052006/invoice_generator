import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  PlusCircle, Users, Package, FileText, 
  Settings, LogOut, Home, LayoutDashboard,
  ShieldCheck, UserPlus, Menu, X, Bell, Search,
  ClipboardList, FileCheck, BarChart3
} from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config';


// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import SettingsPage from './pages/Settings';
import AdminUsers from './pages/AdminUsers';
import Quotations from './pages/Quotations';
import Proformas from './pages/Proformas';
import Reports from './pages/Reports';

import logo from './assets/logo.png';

const SidebarLink = ({ to, label, icon: Icon }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      color: isActive ? 'var(--primary-color)' : '#6b7280',
      textDecoration: 'none',
      fontWeight: isActive ? '600' : '500',
      fontSize: '14px',
      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
      borderRight: isActive ? '3px solid var(--primary-color)' : 'none',
      transition: 'all 0.15s ease'
    })}
  >
    {({ isActive }) => (
      <>
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

const AppLayout = ({ user, logout, company, logoVersion, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 99,
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{
        width: '260px',
        backgroundColor: 'var(--secondary-color)',
        borderRight: '1px solid #eaedf3',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 100
      }}>
        {/* Brand Block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 20px', borderBottom: '1px solid #fafafa' }}>
          {company?.logo_url ? (
            <img 
              src={`${company.logo_url}?v=${logoVersion}`} 
              alt="Company Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain' }} 
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'var(--primary-color)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '18px',
              letterSpacing: '-1px'
            }}>
              {company?.name ? company.name.substring(0, 2).toUpperCase() : 'DV'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '800', fontSize: '15px', color: '#09090b', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {company?.name || 'Digital Viyabari'}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', letterSpacing: '0.05em' }}>
              ENTERPRISE BILLING
            </span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 0' }}>
          <SidebarLink to="/" label="Dashboard" icon={LayoutDashboard} />
          
          {user?.role === 'user' && (
            <>
              <SidebarLink to="/invoices/new" label="New Invoice" icon={PlusCircle} />
              <SidebarLink to="/clients" label="Customers" icon={Users} />
              <SidebarLink to="/products" label="Inventory" icon={Package} />
              <SidebarLink to="/invoices" label="Transactions" icon={FileText} />
              <SidebarLink to="/quotations" label="Quotations" icon={ClipboardList} />
              <SidebarLink to="/proformas" label="Proforma" icon={FileCheck} />
              <SidebarLink to="/reports" label="Reports" icon={BarChart3} />
            </>
          )}

          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <SidebarLink to="/admin/users" label={user?.role === 'super_admin' ? "Managers" : "Employees"} icon={UserPlus} />
          )}
          <SidebarLink to="/settings" label="Settings" icon={Settings} />

          {/* New Invoice Button in Sidebar */}
          {user?.role === 'user' && (
            <div style={{ padding: '20px 16px 10px 16px' }}>
              <button 
                onClick={() => navigate('/invoices/new')}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: 'var(--primary-color)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
              >
                <PlusCircle size={16} /> NEW INVOICE
              </button>
            </div>
          )}
        </nav>

        {/* Bottom Sidebar Block */}
        <div style={{ borderTop: '1px solid #eaedf3', padding: '16px 0' }}>
          <SidebarLink to="/settings" label="Support" icon={Home} />
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); logout(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              color: '#6b7280',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '14px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <LogOut size={18} strokeWidth={2} style={{ marginRight: '2px' }} />
            <span>Logout</span>
          </a>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header className="top-header" style={{
          height: '64px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #eaedf3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          {/* Mobile toggle for responsive navigation drawer */}
          <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(true)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
            <Menu size={22} color="#09090b" />
          </button>

          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '400px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af'
              }} />
              <input
                type="text"
                placeholder="Search invoices, customers, etc."
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #eaedf3',
                  borderRadius: '6px',
                  paddingLeft: '38px',
                  paddingRight: '16px',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  color: '#1f2937'
                }}
                onFocus={e => { e.target.style.backgroundColor = '#ffffff'; e.target.style.borderColor = '#09090b'; }}
                onBlur={e => { e.target.style.backgroundColor = '#f8fafc'; e.target.style.borderColor = '#eaedf3'; }}
              />
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Bell Icon */}
            <button style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4b5563'
            }}>
              <Bell size={20} />
              <span style={{
                position: 'absolute', top: '4px', right: '4px',
                width: '6px', height: '6px',
                backgroundColor: '#ef4444', borderRadius: '50%'
              }} />
            </button>

            {/* Help Question-mark Icon */}
            <button style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4b5563'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>

            {/* Avatar with blue background */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px solid #e0f2fe'
            }}>
              {user?.full_name?.[0] || 'U'}
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="content-wrapper" style={{ padding: '40px', flex: 1, backgroundColor: '#f8fafc' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      console.warn("Corrupted user localStorage state, resetting.", e);
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [company, setCompany] = useState(null);
  const [logoVersion, setLogoVersion] = useState(Date.now());

  const fetchCompany = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/company`);
      setCompany(res.data);
      setLogoVersion(Date.now());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const primary = company?.primary_color || '#2563eb';
    const secondary = company?.secondary_color || '#ffffff';

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
  }, [company]);

  const login = (userData, token) => {
    setUser(userData);
    setToken(token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchCompany();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setCompany(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCompany();
    }
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [token]);

  const isLoggedIn = !!token && !!user;

  return (
    <Router>
      {!isLoggedIn ? (
        <Routes>
          <Route path="/login" element={<Login login={login} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <AppLayout user={user} logout={logout} company={company} logoVersion={logoVersion}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/clients" element={<Clients user={user} />} />
            <Route path="/products" element={<Products user={user} />} />
            <Route path="/invoices" element={<Invoices user={user} />} />
            <Route path="/invoices/new" element={<CreateInvoice key="create-invoice" user={user} type="invoice" />} />
            <Route path="/quotations" element={<Quotations user={user} />} />
            <Route path="/quotations/new" element={<CreateInvoice key="create-quotation" user={user} type="quotation" />} />
            <Route path="/proformas" element={<Proformas user={user} />} />
            <Route path="/proformas/new" element={<CreateInvoice key="create-proforma" user={user} type="proforma" />} />
            <Route path="/reports" element={<Reports user={user} />} />
            <Route path="/settings" element={<SettingsPage user={user} fetchCompanyGlobal={fetchCompany} />} />
            <Route path="/admin/users" element={<AdminUsers user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AppLayout>
      )}
    </Router>
  );
};

export default App;

