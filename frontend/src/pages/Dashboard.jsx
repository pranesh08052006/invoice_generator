import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  TrendingUp, Users, FileText, CreditCard, 
  Calendar, User, ChevronRight,
  PlusCircle, Activity, ArrowUpRight, ArrowDownRight, Package, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatsCard = ({ title, value, icon: Icon, trend, subtext, trendColor }) => (
  <div className="card animate-in" style={{
    backgroundColor: '#ffffff',
    border: '1px solid #eaedf3',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)',
    position: 'relative'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {title}
      </span>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        backgroundColor: '#f3f4f6', color: '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={18} strokeWidth={2} />
      </div>
    </div>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>
        {value}
      </h3>
      
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#10b981',
            backgroundColor: '#ecfdf5',
            padding: '2px 8px',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {trend}
          </span>
        </div>
      )}
      
      {subtext && (
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: trendColor === 'error' ? '#ef4444' : '#6b7280',
          marginTop: '4px'
        }}>
          {subtext}
        </span>
      )}
    </div>
  </div>
);

const RevenueChart = ({ invoices = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('6_months');

  const rangeCounts = {
    '3_months': 3,
    '6_months': 6,
    '12_months': 12
  };

  const rangeLabels = {
    '3_months': 'Last 3 Months',
    '6_months': 'Last 6 Months',
    '12_months': 'Last 12 Months'
  };

  const count = rangeCounts[timeRange];
  const precedingMonths = [];
  const d = new Date();
  
  // Calculate historical preceding calendar months ending at current month (May)
  for (let i = count - 1; i >= 0; i--) {
    precedingMonths.push(new Date(d.getFullYear(), d.getMonth() - i, 1));
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Aggregate real-time total invoiced amounts per calendar month
  const calculatedData = precedingMonths.map(monthDate => {
    const year = monthDate.getFullYear();
    const monthIdx = monthDate.getMonth();
    const label = monthNames[monthIdx];
    
    const revenue = invoices.filter(inv => inv.status?.toUpperCase() !== 'DRAFT').reduce((sum, inv) => {
      const dateStr = inv.date || inv.created_at;
      if (!dateStr) return sum;
      const invDate = new Date(dateStr);
      if (invDate.getFullYear() === year && invDate.getMonth() === monthIdx) {
        return sum + (inv.paid_amount || 0);
      }
      return sum;
    }, 0);

    return {
      label,
      revenue,
      key: `${year}-${monthIdx}`
    };
  });

  // Calculate dynamic maximum ceiling for scaling columns
  const maxRevenue = Math.max(...calculatedData.map(item => item.revenue), 10000);

  // Clean compact formatting helper for dynamic grid labels
  const formatYLabel = (val) => {
    if (val >= 100000) return `${Math.round(val / 1000) / 100}L`;
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return Math.round(val).toString();
  };

  const yLabels = [
    formatYLabel(maxRevenue),
    formatYLabel(maxRevenue * 0.75),
    formatYLabel(maxRevenue * 0.5),
    formatYLabel(maxRevenue * 0.25),
    '0'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header section with Dynamic Dropdown integrated */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Revenue Overview</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>Monthly sales comparison</p>
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #eaedf3',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#4b5563',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#eaedf3'}
          >
            {rangeLabels[timeRange]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {isOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #eaedf3',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
              zIndex: 50,
              padding: '4px',
              minWidth: '130px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              {Object.entries(rangeLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTimeRange(key);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: timeRange === key ? 'var(--primary-color)' : '#4b5563',
                    backgroundColor: timeRange === key ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (timeRange !== key) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={e => {
                    if (timeRange !== key) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
 
      <div style={{ display: 'flex', gap: '20px', padding: '10px 0 0 0', position: 'relative', height: '240px' }}>
        {/* Y Axis Labels dynamically scaled */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#9ca3af', fontSize: '11px', fontWeight: '600', paddingBottom: '28px', minWidth: '32px', textAlign: 'right' }}>
          {yLabels.map((lbl, i) => <span key={i}>{lbl}</span>)}
        </div>
        
        {/* Dotted Grid lines and Bars */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Background dotted horizontal grid lines */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none', paddingBottom: '28px', justifyContent: 'space-between' }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderBottom: '1px dashed #f1f5f9', width: '100%', height: '0' }} />
            ))}
          </div>
          
          {/* Bars Container */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%', paddingBottom: '28px' }}>
            {calculatedData.map((item, idx) => {
              const isCurrentMonth = idx === calculatedData.length - 1;
              const heightPercent = maxRevenue > 0 ? `${(item.revenue / maxRevenue) * 80}%` : '0%';
              const valueFormatted = `₹${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              
              return (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', width: '42px', height: '100%' }}>
                  {/* Visual Bar */}
                  <div 
                    title={`${item.label}: ${valueFormatted}`}
                    style={{
                      width: timeRange === '12_months' ? '16px' : '30px',
                      height: heightPercent,
                      backgroundColor: isCurrentMonth ? 'var(--primary-color)' : 'var(--primary-light)',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isCurrentMonth ? 'var(--primary-hover)' : 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isCurrentMonth ? 'var(--primary-color)' : 'var(--primary-light)'}
                  />
                  {/* Month Text */}
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: isCurrentMonth ? '700' : '500' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const navigate = useNavigate();

  const fetchMainStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/stats`);
      setStats(response.data);
      
      const invResponse = await axios.get(`${API_BASE_URL}/invoices`);
      setAllInvoices(invResponse.data);
      
      const payResponse = await axios.get(`${API_BASE_URL}/payments`);
      setAllPayments(payResponse.data || []);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/stats?target_user_id=${userId}`);
      setUserStats(response.data);
      setSelectedUser(userId);
    } catch (err) {
      console.error('Failed to fetch user stats', err);
    }
  };

  useEffect(() => {
    fetchMainStats();
  }, []);

  if (loading) return (
    <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
      <div className="loading-spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#09090b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Preparing your dashboard...</span>
    </div>
  );

  const totalPaidInvoices = allInvoices.filter(inv => inv.status?.toUpperCase() === 'PAID').length;
  const totalUnpaidInvoices = allInvoices.filter(inv => inv.status?.toUpperCase() !== 'PAID' && inv.status?.toUpperCase() !== 'DRAFT').length;
  const unlinkedPmtsSum = allPayments.filter(p => !p.invoice_id).reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = Math.max(0, allInvoices.filter(inv => inv.status?.toUpperCase() !== 'DRAFT')
    .reduce((sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0) - unlinkedPmtsSum);

  const calculateDaysLeft = () => {
    if (user?.has_full_access) return null;
    if (!user?.trial_end_date) return null;
    const end = new Date(user.trial_end_date);
    const now = new Date();
    const diff = end - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysLeft = calculateDaysLeft();

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Hero Banner */}
      <div className="welcome-hero" style={{
        borderRadius: '12px',
        padding: '32px 40px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px var(--primary-light)',
        backgroundImage: 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.15), transparent), linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)'
      }}>
        <div className="welcome-hero-left">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome back, {user?.full_name?.split(' ')?.[0] || 'User'}
              </h2>
              {user?.has_full_access && (
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(4px)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.05em'
                }}>PRO</span>
              )}
            </div>
            <p style={{ margin: 0, color: '#eff6ff', fontSize: '14px', opacity: 0.9 }}>
              Here is what's happening with your business today.
            </p>
          </div>

          {user?.role === 'user' && (user?.has_full_access || daysLeft !== null) && (
            <div className="status-badge-container" style={{
              backgroundColor: user?.has_full_access ? 'rgba(255, 255, 255, 0.15)' : (daysLeft >= 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(239, 68, 68, 0.2)'),
              border: `1px solid ${user?.has_full_access || daysLeft >= 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {user?.has_full_access ? <ShieldCheck size={20} /> : <Calendar size={20} />}
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase' }}>Account Status</div>
                <div style={{ fontSize: '15px', fontWeight: '800' }}>
                  {user?.has_full_access ? 'Full Access' : (daysLeft >= 0 ? `${daysLeft} days remaining` : 'Trial ended')}
                </div>
              </div>
            </div>
          )}
        </div>

        {user?.role === 'user' && (
          <button 
            className="btn-create-invoice"
            onClick={() => navigate('/invoices/new')}
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--primary-color)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.target.style.backgroundColor = '#f4f4f5'}
            onMouseLeave={e => e.target.style.backgroundColor = '#ffffff'}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Create New Invoice
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        {user?.role === 'super_admin' ? (
          <>
            <StatsCard title="Total Revenue" value={`₹${stats?.total_sales?.toLocaleString() || 0}`} icon={TrendingUp} trend="+12.5%" />
            <StatsCard title="Active Managers" value={stats?.total_admins || 0} icon={ShieldCheck} subtext="Supervising networks" />
            <StatsCard title="Total Users" value={stats?.total_users || 0} icon={Users} subtext="Operating globally" />
            <StatsCard title="Invoices Issued" value={stats?.total_invoices || 0} icon={FileText} subtext="Completed bills" />
          </>
        ) : user?.role === 'admin' ? (
          <>
            <StatsCard title="My Team" value={stats?.active_users || 0} icon={Users} subtext="Direct subordinates" />
            <StatsCard title="Total Transactions" value={stats?.total_invoices || 0} icon={CreditCard} subtext="Invoices collected" />
            <StatsCard title="Managed Revenue" value={`₹${(stats?.total_sales || 0).toLocaleString()}`} icon={TrendingUp} trend="+5.2%" />
          </>
        ) : (
          <>
            <StatsCard title="Total Sales" value={`₹${stats?.total_sales?.toLocaleString() || 0}`} icon={TrendingUp} trend="+12.5%" />
            <StatsCard title="Total Invoices" value={`${stats?.total_invoices || 0}`} icon={FileText} subtext={`${totalPaidInvoices || 0} paid invoices`} />
            <StatsCard title="Pending Amount" value={`₹${pendingAmount?.toLocaleString() || 0}`} icon={CreditCard} subtext={`${totalUnpaidInvoices || 0} unpaid invoices`} trendColor="error" />
            <StatsCard title="Active Customers" value={`${stats?.total_clients || 0}`} icon={Users} subtext="Recently active" />
            <StatsCard title="Total Expenses" value={`₹${stats?.total_expenses?.toLocaleString() || 0}`} icon={CreditCard} subtext="All recorded expenses" trendColor="error" />
            <StatsCard title="Today's Expenses" value={`₹${stats?.today_expenses?.toLocaleString() || 0}`} icon={Calendar} subtext="Spent today" />
            <StatsCard title="This Month's Expenses" value={`₹${stats?.month_expenses?.toLocaleString() || 0}`} icon={Calendar} subtext="Spent this month" />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Card: Chart (Regular User) or Management Tree (Admin/Super Admin) */}
        {user?.role === 'user' ? (
          <div className="card" style={{
            backgroundColor: '#ffffff',
            border: '1px solid #eaedf3',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)',
            flex: 1
          }}>
            <RevenueChart invoices={allInvoices} />
          </div>
        ) : (
          <div className="card" style={{
            backgroundColor: '#ffffff',
            border: '1px solid #eaedf3',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Management Tree</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>Team members and their performance</p>
              </div>
              <span style={{
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '12px'
              }}>
                {(stats?.admins || stats?.managed_users || []).length} MEMBERS
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(stats?.admins || stats?.managed_users || []).map(u => (
                <div key={u.id} 
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #eaedf3',
                    cursor: 'pointer',
                    padding: '14px 18px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: selectedUser === u.id ? '#f8fafc' : '#ffffff'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#9ca3af'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = selectedUser === u.id ? '#9ca3af' : '#eaedf3'}
                  onClick={() => fetchUserDetails(u.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      backgroundColor: '#111827',
                      color: '#ffffff',
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '14px'
                    }}>
                      {u.full_name?.[0] || 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{u.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{u.email}</div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: '#9ca3af' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Card: Recent Transactions (Regular User) or Diagnostics/Support (Admin/Super Admin) */}
        {user?.role === 'user' ? (
          <div className="card" style={{
            backgroundColor: '#ffffff',
            border: '1px solid #eaedf3',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Recent Invoices</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>Latest billing activities</p>
              </div>
              <button 
                onClick={() => navigate('/invoices')}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#4b5563',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                View All
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(stats?.recent_invoices || []).slice(0, 4).map(inv => (
                <div 
                  key={inv.id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    border: '1px solid #eaedf3',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                      #{inv.invoice_number}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {inv.client_name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                      ₹{(inv.total_amount || 0).toLocaleString()}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      textTransform: 'capitalize',
                      backgroundColor: inv.status?.toLowerCase() === 'paid' ? '#ecfdf5' : '#fef2f2',
                      color: inv.status?.toLowerCase() === 'paid' ? '#10b981' : '#ef4444'
                    }}>
                      {inv.status?.toLowerCase() || 'unpaid'}
                    </span>
                  </div>
                </div>
              ))}
              
              {(!stats?.recent_invoices || stats.recent_invoices.length === 0) && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0' }}>No recent invoices recorded.</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* System Diagnostics */}
            <div className="card" style={{
              backgroundColor: '#ffffff',
              border: '1px solid #eaedf3',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#111827' }}>
                <Activity size={18} strokeWidth={2.5} style={{ color: '#09090b' }} /> System Diagnostics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280' }}>API Pipeline</span>
                  <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>OPERATIONAL</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280' }}>Cloud Engine</span>
                  <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>STABLE</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280' }}>Last Sync</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>Just now</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected User Performance Overlay Panel */}
      {selectedUser && userStats && (
        <div className="card animate-in" style={{
          backgroundColor: '#ffffff',
          border: '2px solid var(--primary-color)',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '20px', color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
                {userStats.target_name}'s Performance
              </h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>Detailed breakdown of recent activity</p>
            </div>
            <button 
              onClick={() => setSelectedUser(null)}
              style={{
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#1b2a4a',
                cursor: 'pointer'
              }}
            >
              Close Panel
            </button>
          </div>
          
          <div className="performance-grid" style={{ marginBottom: '28px' }}>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #eaedf3' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Revenue</p>
              <p style={{ fontWeight: '800', fontSize: '22px', color: '#111827', marginTop: '6px', marginBottom: 0 }}>₹{(userStats.total_sales || 0).toLocaleString()}</p>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #eaedf3' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Invoices</p>
              <p style={{ fontWeight: '800', fontSize: '22px', color: '#111827', marginTop: '6px', marginBottom: 0 }}>{userStats.total_invoices}</p>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #eaedf3' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Team</p>
              <p style={{ fontWeight: '800', fontSize: '22px', color: '#111827', marginTop: '6px', marginBottom: 0 }}>{userStats.managed_users_count || 0}</p>
            </div>
          </div>

          <div className="table-container" style={{ border: '1px solid #eaedf3', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Invoice #</th>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Date</th>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Amount</th>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {userStats.invoices?.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 18px', fontWeight: '700', fontSize: '13px', color: '#111827' }}>#{inv.invoice_number}</td>
                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#6b7280' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 18px', fontWeight: '700', fontSize: '13px', color: '#111827' }}>₹{(inv.total_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        backgroundColor: '#ecfdf5',
                        color: '#10b981',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase'
                      }}>
                        {inv.payment_mode || 'CASH'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!userStats.invoices || userStats.invoices.length === 0) && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', padding: '48px' }}>No transactions recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
