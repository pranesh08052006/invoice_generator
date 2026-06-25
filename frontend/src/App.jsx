import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  PlusCircle, Users, Package, FileText, 
  Settings, LogOut, Home, LayoutDashboard,
  ShieldCheck, UserPlus, Menu, X, Bell, Search,
  ClipboardList, FileCheck, BarChart3, AlertTriangle,
  CreditCard
} from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config';


// Set global axios defaults on load to prevent refresh race conditions
const initialToken = localStorage.getItem('token');
if (initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}


// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
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
import Expenses from './pages/Expenses';

import logo from './assets/logo.png';

const SidebarLink = ({ to, label, icon: Icon, onClick }) => (
  <NavLink 
    to={to} 
    end
    onClick={onClick}
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

// ── Scroll to top on every route change ──
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

const AppLayout = ({ user, logout, company, logoVersion, children }) => {

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Interactive top header states
  const [activeDropdown, setActiveDropdown] = useState(null); // 'notifications' | 'profile' | null
  
  // Track read and deleted notifications IDs in localStorage to persist user actions
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const saved = localStorage.getItem('read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [deletedNotificationIds, setDeletedNotificationIds] = useState(() => {
    try {
      const saved = localStorage.getItem('deleted_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [dynamicNotifications, setDynamicNotifications] = useState([]);

  useEffect(() => {
    localStorage.setItem('read_notifications', JSON.stringify(readNotificationIds));
  }, [readNotificationIds]);

  useEffect(() => {
    localStorage.setItem('deleted_notifications', JSON.stringify(deletedNotificationIds));
  }, [deletedNotificationIds]);

  const staticNotifications = [
    { id: 'welcome', title: 'Welcome to Digital Viyabari!', message: 'Explore your dashboard and set up company settings.', time: 'Just now', type: 'info' },
    { id: 'backup', title: 'Database Backup Completed', message: 'Your business data was successfully backed up.', time: '1 hour ago', type: 'success' },
    { id: 'update', title: 'System Update', message: 'New invoicing templates are now available.', time: '2 hours ago', type: 'system' }
  ];

  const fetchDynamicNotifications = useCallback(async () => {
    if (user?.role !== 'user') return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const [productsRes, invoicesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/products`),
        axios.get(`${API_BASE_URL}/invoices`)
      ]);
      
      const newDynamic = [];
      
      // Check for low stock (products with stock <= 5)
      if (Array.isArray(productsRes.data)) {
        productsRes.data.forEach(p => {
          if (p.item_type === 'product' && p.stock <= 5) {
            newDynamic.push({
              id: `low-stock-${p.id}`,
              title: 'Low Stock Warning',
              message: `${p.name} is running low on stock (${p.stock} ${p.unit || 'Units'} left)`,
              type: 'system',
              time: 'Real-time'
            });
          }
        });
      }
      
      // Check for draft invoices (invoices with status === 'DRAFT')
      if (Array.isArray(invoicesRes.data)) {
        invoicesRes.data.forEach(inv => {
          if (inv.status === 'DRAFT' && !inv.is_deleted) {
            newDynamic.push({
              id: `draft-invoice-${inv.id}`,
              title: 'Pending Draft Invoice',
              message: `Draft invoice ${inv.invoice_number} is pending. Total: ₹${inv.total_amount.toLocaleString()}`,
              type: 'info',
              time: 'Real-time'
            });
          }
        });
      }
      
      setDynamicNotifications(newDynamic);
    } catch (err) {
      console.warn("Failed to fetch notification sources", err);
    }
  }, [user]);

  useEffect(() => {
    fetchDynamicNotifications();
    if (user?.role === 'user') {
      const interval = setInterval(fetchDynamicNotifications, 10000); // update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [fetchDynamicNotifications, user]);

  const allNotifications = [
    ...staticNotifications,
    ...dynamicNotifications
  ].filter(n => !deletedNotificationIds.includes(n.id));

  const notificationsWithReadState = allNotifications.map(n => ({
    ...n,
    read: readNotificationIds.includes(n.id)
  }));

  const unreadNotificationsCount = notificationsWithReadState.filter(n => !n.read).length;

  const markAllNotificationsAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadNotificationIds(prev => {
      const union = new Set([...prev, ...allIds]);
      return Array.from(union);
    });
  };

  const toggleNotificationRead = (id) => {
    setReadNotificationIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const deleteNotification = (id, event) => {
    event.stopPropagation(); // prevent triggering click/read toggle
    setDeletedNotificationIds(prev => [...prev, id]);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.header-control-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
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
        backgroundColor: 'var(--secondary-color)'
      }}>
        {/* Brand Block */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px', borderBottom: '1px solid #fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          
          <button 
            className="mobile-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 0', overflowY: 'auto' }}>
          <SidebarLink to="/" label="Dashboard" icon={LayoutDashboard} onClick={() => setIsMobileMenuOpen(false)} />
          
          {/* Operational pages for standard billing users */}
          {user?.role === 'user' && (
            <>
              <SidebarLink to="/invoices/new" label="New Invoice" icon={PlusCircle} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/clients" label="Customers" icon={Users} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/products" label="Inventory" icon={Package} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/invoices" label="Transactions" icon={FileText} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/quotations" label="Quotations" icon={ClipboardList} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/proformas" label="Proforma" icon={FileCheck} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/expenses" label="Expenses" icon={CreditCard} onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/reports" label="Reports" icon={BarChart3} onClick={() => setIsMobileMenuOpen(false)} />
            </>
          )}

          {/* Super Admin Management Section is now consolidated below */}


          {/* Admin/Super Admin Management Section */}
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <SidebarLink to="/admin/users" label={user?.role === 'super_admin' ? "Managers" : "Users"} icon={UserPlus} onClick={() => setIsMobileMenuOpen(false)} />
          )}
          <SidebarLink to="/settings" label="Settings" icon={Settings} onClick={() => setIsMobileMenuOpen(false)} />

          {/* Floating New Invoice Button (User only) */}
          {user?.role === 'user' && (
            <div style={{ padding: '20px 16px 10px 16px' }}>
              <button 
                onClick={() => { navigate('/invoices/new'); setIsMobileMenuOpen(false); }}
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
          <SidebarLink to="/settings" label="Support" icon={Home} onClick={() => setIsMobileMenuOpen(false)} />
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); logout(); setIsMobileMenuOpen(false); }}
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
      <main className="main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Top Header */}
        <header className="top-header" style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #eaedf3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          {/* Mobile toggle for responsive navigation drawer */}
          <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
            <Menu size={22} color="#09090b" />
          </button>

          {/* Search Bar */}
          <div className="header-search-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '400px' }}>
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
            <div className="header-control-container">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'notifications' ? null : 'notifications')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activeDropdown === 'notifications' ? 'var(--primary-color)' : '#4b5563',
                  transition: 'color 0.2s ease'
                }}
              >
                <Bell size={20} />
                {unreadNotificationsCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '16px', height: '16px',
                    backgroundColor: '#ef4444', borderRadius: '50%',
                    color: '#ffffff', fontSize: '9px', fontWeight: '800',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {activeDropdown === 'notifications' && (
                <div className="header-dropdown" style={{ width: '340px' }}>
                  <div className="dropdown-header">
                    <span className="dropdown-title">Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <button onClick={markAllNotificationsAsRead} className="dropdown-action">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="dropdown-body no-scrollbar">
                    {notificationsWithReadState.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                        No notifications
                      </div>
                    ) : (
                      notificationsWithReadState.map(n => (
                        <div 
                          key={n.id} 
                          className={`dropdown-item ${!n.read ? 'unread' : ''}`}
                          onClick={() => toggleNotificationRead(n.id)}
                          style={{ position: 'relative', paddingRight: '40px' }}
                        >
                          <div className={`notification-icon-container ${n.type}`}>
                            {n.type === 'success' && <ShieldCheck size={16} />}
                            {n.type === 'info' && <Bell size={16} />}
                            {n.type === 'system' && <AlertTriangle size={16} />}
                          </div>
                          <div className="notification-content">
                            <span className="notification-item-title">{n.title}</span>
                            <span className="notification-message">{n.message}</span>
                            <span className="notification-time">{n.time}</span>
                          </div>
                          
                          {/* Close/Cancel X button */}
                          <button
                            onClick={(e) => deleteNotification(n.id, e)}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: 'none',
                              border: 'none',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'all 0.2s ease',
                              zIndex: 10
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar with blue background */}
            <div className="header-control-container">
              <div 
                onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
                style={{
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
                  border: activeDropdown === 'profile' ? '2px solid var(--primary-color)' : '2px solid #e0f2fe',
                  transition: 'all 0.2s ease'
                }}
              >
                {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
              </div>

              {activeDropdown === 'profile' && (
                <div className="header-dropdown" style={{ width: '220px' }}>
                  <div className="profile-dropdown-header">
                    <span className="profile-dropdown-name">{user?.full_name || user?.username || 'User'}</span>
                    <span className="profile-dropdown-role">
                      {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Manager' : 'Billing Manager'}
                    </span>
                  </div>
                  <div className="dropdown-body no-scrollbar">
                    <button 
                      onClick={() => { navigate('/settings'); setActiveDropdown(null); }}
                      className="profile-dropdown-btn"
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                    <button 
                      onClick={() => { logout(); setActiveDropdown(null); }}
                      className="profile-dropdown-btn danger"
                      style={{ borderTop: '1px solid var(--border-light)' }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="content-wrapper" style={{ flex: 1, height: 0, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
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
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');

  const fetchMe = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      console.error("Failed to refresh user data", err);
      if (err.response?.status === 401) logout();
    }
  };

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
    setSessionExpiredMsg('');
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchCompany();
  };

  const logout = useCallback(async (showSessionMsg = false) => {
    const currentToken = localStorage.getItem('token');
    
    // Clear all local auth state synchronously first to prevent any loops
    setUser(null);
    setToken(null);
    setCompany(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    
    if (showSessionMsg) {
      setSessionExpiredMsg('Your account has been logged in from another device. Please login again.');
    }
    
    // Only call backend logout if we have a token and it was a manual logout (token not already invalid)
    if (currentToken && !showSessionMsg) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, null, {
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch (_) {
        // Ignore errors as we are already cleared locally
      }
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
      fetchCompany();
    }
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const detail = error.response?.data?.detail || '';
          const message = error.response?.data?.message || '';
          if (detail === 'Session expired. Please login again.' || message === 'Session expired. Please login again.') {
            // Another device logged in — show the notification toast
            logout(true);
          } else {
            // Generic 401 (expired/invalid token, deleted user, etc.)
            logout(false);
          }
        }
        if (error.response?.status === 402) {
          alert(error.response.data.detail || 'Access restricted. Please contact your manager.');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [token, logout]);

  // Periodically check session validity for all users every 5 seconds to trigger real-time logout
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        await axios.get(`${API_BASE_URL}/auth/me`);
      } catch (err) {
        // Axios interceptor will handle the 401 Session Expired response automatically
        console.warn("Session check failed", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  const isLoggedIn = !!token && !!user;

  return (
    <Router>
      <ScrollToTop />
      {!isLoggedIn ? (
        <Routes>
          <Route path="/login" element={
            <Login
              login={login}
              sessionExpiredMsg={sessionExpiredMsg}
              onDismissSessionMsg={() => setSessionExpiredMsg('')}
            />
          } />
          <Route path="/signup" element={
            <Signup login={login} />
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <AppLayout user={user} logout={logout} company={company} logoVersion={logoVersion}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            
            {/* Operational routes guarded for standard users only */}
            <Route path="/clients" element={user?.role === 'user' ? <Clients user={user} company={company} /> : <Navigate to="/" />} />
            <Route path="/products" element={user?.role === 'user' ? <Products user={user} /> : <Navigate to="/" />} />
            <Route path="/invoices" element={user?.role === 'user' ? <Invoices user={user} /> : <Navigate to="/" />} />
            <Route path="/invoices/new" element={user?.role === 'user' ? <CreateInvoice key="create-invoice" user={user} type="invoice" /> : <Navigate to="/" />} />
            <Route path="/quotations" element={user?.role === 'user' ? <Quotations user={user} /> : <Navigate to="/" />} />
            <Route path="/quotations/new" element={user?.role === 'user' ? <CreateInvoice key="create-quotation" user={user} type="quotation" /> : <Navigate to="/" />} />
            <Route path="/proformas" element={user?.role === 'user' ? <Proformas user={user} /> : <Navigate to="/" />} />
            <Route path="/proformas/new" element={user?.role === 'user' ? <CreateInvoice key="create-proforma" user={user} type="proforma" /> : <Navigate to="/" />} />
            <Route path="/reports" element={user?.role === 'user' ? <Reports user={user} company={company} /> : <Navigate to="/" />} />
            <Route path="/expenses" element={user?.role === 'user' ? <Expenses user={user} /> : <Navigate to="/" />} />
            
            <Route path="/settings" element={<SettingsPage user={user} fetchCompanyGlobal={fetchCompany} />} />
            
            {/* Admin management routes guarded for admins and super admins only */}
            <Route path="/admin/users" element={user?.role === 'super_admin' || user?.role === 'admin' ? <AdminUsers user={user} /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AppLayout>
      )}
    </Router>
  );
};

export default App;

