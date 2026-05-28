import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import { UserPlus, Trash2, Shield, User, Mail, Plus, X, Lock, Key, Check } from 'lucide-react';

const AdminUsers = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ 
    full_name: '', 
    email: '', 
    password: '', 
    role: user?.role === 'super_admin' ? 'admin' : 'user' 
  });

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/users`);
      setUsers(response.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/admin/users`, newUser);
      setShowModal(false);
      setNewUser({ 
        full_name: '', 
        email: '', 
        password: '', 
        role: user?.role === 'super_admin' ? 'admin' : 'user' 
      });
      fetchUsers();
    } catch (err) {
      alert('Error creating user. Check if the email is unique.');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to remove this user from the organization?')) {
      try {
        await axios.delete(`${API_BASE_URL}/admin/users/${userId}`);
        fetchUsers();
      } catch (err) {
        alert('Error removing user');
      }
    }
  };

  const toggleAccess = async (targetUser) => {
    try {
      const newStatus = !targetUser.has_full_access;
      await axios.patch(`${API_BASE_URL}/admin/users/${targetUser.id}/access`, {
        has_full_access: newStatus
      });
      fetchUsers();
    } catch (err) {
      alert('Error updating access');
    }
  };

  const getTrialDays = (trialEndDate) => {
    if (!trialEndDate) return 0;
    const days = Math.floor((new Date(trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : -1;
  };

  const getRoleBadge = (role) => {
    const config = {
      super_admin: { label: 'System Owner', variant: 'badge-success' },
      admin: { label: 'Administrator', variant: 'badge-success' },
      user: { label: 'Billing Agent', variant: 'badge-muted' },
    };
    const c = config[role] || config.user;
    return (
      <div className={`badge ${c.variant}`} style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: '800' }}>
        {c.label}
      </div>
    );
  };

  return (
    <>
      <div className="animate-in">
        <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-main)' }}>Team Management</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Control access levels and manage administrative accounts for your team.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)' }}>
          <UserPlus size={18} /> Provision New Account
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--primary-color)' }}>
          <Shield size={20} color="var(--primary-color)" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-color)' }}>{users.filter(u => u.role === 'super_admin' || u.role === 'admin').length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active Administrators</div>
        </div>
        <div className="card" style={{ padding: '24px', borderLeft: '4px solid #94a3b8' }}>
          <User size={20} color="#64748b" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '24px', fontWeight: '800' }}>{users.filter(u => u.role === 'user').length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Standard Accounts</div>
        </div>
        <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-muted)', border: '1px dashed var(--border)' }}>
          <Lock size={20} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-dim)' }}>Unlimited</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Provisioning Capacity</div>
        </div>
      </div>

      <div className="table-container shadow-premium">
        <table>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>User Entity</th>
              <th style={{ width: '25%' }}>Authentication</th>
              <th style={{ width: '15%' }}>Access Level</th>
              <th style={{ width: '15%' }}>Trial/Access</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Management</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-4">
                    <div className="avatar" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff', width: '40px', height: '40px', borderRadius: '10px', fontSize: '14px', fontWeight: '700' }}>
                      {u.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '15px', display: 'block' }}>{u.full_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '500' }}>Created {new Date(u.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {u.email}
                  </div>
                </td>
                <td>{getRoleBadge(u.role)}</td>
                <td>
                  {u.role === 'user' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '800', 
                        color: u.has_full_access ? 'var(--success)' : (getTrialDays(u.trial_end_date) >= 0 ? 'var(--text-muted)' : '#ef4444'),
                        letterSpacing: '0.05em'
                      }}>
                        {u.has_full_access ? '• FULL ACCESS' : (getTrialDays(u.trial_end_date) >= 0 ? `${getTrialDays(u.trial_end_date)} DAYS LEFT` : 'TRIAL COMPLETED')}
                      </span>
                      <button 
                        onClick={() => toggleAccess(u)}
                        style={{
                          backgroundColor: u.has_full_access ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                          border: `1px solid ${u.has_full_access ? 'rgba(239, 68, 68, 0.2)' : 'rgba(37, 99, 235, 0.2)'}`,
                          color: u.has_full_access ? '#ef4444' : 'var(--primary-color)',
                          fontSize: '10px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          transition: 'all 0.2s ease',
                          width: 'fit-content'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        {u.has_full_access ? 'Restrict Access' : 'Grant Full Access'}
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {u.role !== 'super_admin' && (
                    <button className="logout-btn" onClick={() => handleDelete(u.id)} title="Deprovision Account">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>Provision Account</h2>
              <button type="button" onClick={() => setShowModal(false)} className="logout-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label className="input-label">Legal Name</label>
                  <input placeholder="e.g. John Doe" className="input-field" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} required />
                </div>
                <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label className="input-label">Corporate Email</label>
                  <input placeholder="user@organization.com" className="input-field" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                </div>
                <div className="input-group" style={{ marginBottom: '24px' }}>
                  <label className="input-label">Temporary Password</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input placeholder="Assign initial secret" type="password" className="input-field" style={{ paddingLeft: '36px' }} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: '32px' }}>
                  <label className="input-label">Security Role</label>
                  <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    {user?.role === 'super_admin' ? (
                      <option value="admin">Administrator (Full Access)</option>
                    ) : (
                      <option value="user">Billing Agent (Limited Access)</option>
                    )}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-full" style={{ height: '48px', fontSize: '15px' }}>
                  Provision Access Account
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
