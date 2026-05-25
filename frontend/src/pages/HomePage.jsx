import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { PlusSquare, Users, Package, FileText, Settings, LogOut } from 'lucide-react';

const NavButton = ({ to, label, icon }) => (
  <Link to={to} style={{ 
    textDecoration: 'none', 
    color: '#000', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#fff',
    border: '1px solid #e2e8f0',
    padding: '40px 20px',
    gap: '15px',
    borderRadius: '20px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    transition: 'all 0.2s'
  }}
  onMouseEnter={e => {
    e.currentTarget.style.transform = 'translateY(-5px)';
    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
  }}
  onMouseLeave={e => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
  }}
  >
    <div style={{ color: '#000' }}>{icon}</div>
    <span style={{ fontWeight: '800', fontSize: '12px', letterSpacing: '0.5px' }}>{label}</span>
  </Link>
);

const HomePage = ({ user, logout }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/dashboard/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
        <div>
          <h1 style={{ textAlign: 'left', margin: 0, fontSize: '28px' }}>HI, {user.full_name.split(' ')[0].toUpperCase()}</h1>
          <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>{user.role.toUpperCase()} ACCOUNT</p>
        </div>
        <button onClick={logout} style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          padding: '12px', 
          borderRadius: '12px', 
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}><LogOut size={20}/></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        <NavButton to="/invoices/new" label="BILLING" icon={<PlusSquare size={32}/>} />
        <NavButton to="/clients" label="CUSTOMERS" icon={<Users size={32}/>} />
        <NavButton to="/products" label="PRODUCTS" icon={<Package size={32}/>} />
        <NavButton to="/invoices" label="HISTORY" icon={<FileText size={32}/>} />
      </div>

      {user.role === 'user' && (
        <div className="card" style={{ padding: '30px', background: '#000', color: '#fff', border: 'none' }}>
          <h3 style={{ fontSize: '11px', marginBottom: '30px', letterSpacing: '1px', opacity: 0.7 }}>OVERVIEW</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '10px', marginBottom: '8px', opacity: 0.7 }}>TOTAL SALES</div>
              <div style={{ fontSize: '24px', fontWeight: '900' }}>₹{stats?.total_sales?.toLocaleString() || 0}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', marginBottom: '8px', opacity: 0.7 }}>INVOICES</div>
              <div style={{ fontSize: '24px', fontWeight: '900' }}>{stats?.total_invoices || 0}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '30px' }}>
        <Link to="/settings" style={{ textDecoration: 'none', color: '#64748b', fontSize: '11px', fontWeight: '700' }}>
          COMPANY SETTINGS
        </Link>
        {(user.role === 'super_admin' || user.role === 'admin') && (
          <Link to="/admin/users" style={{ textDecoration: 'none', color: '#64748b', fontSize: '11px', fontWeight: '700' }}>
            MANAGE USERS
          </Link>
        )}
      </div>
    </div>
  );
};

export default HomePage;
