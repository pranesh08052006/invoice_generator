import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
      const response = await axios.get('http://localhost:8000/admin/users');
      setUsers(response.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/admin/users', newUser);
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
        await axios.delete(`http://localhost:8000/admin/users/${userId}`);
        fetchUsers();
      } catch (err) {
        alert('Error removing user');
      }
    }
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
        <div className="card" style={{ padding: '24px' }}>
          <Shield size={20} color="var(--success)" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '24px', fontWeight: '800' }}>{users.filter(u => u.role === 'super_admin' || u.role === 'admin').length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active Administrators</div>
        </div>
        <div className="card" style={{ padding: '24px' }}>
          <User size={20} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
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
              <th style={{ width: '40%' }}>User Entity</th>
              <th style={{ width: '30%' }}>Authentication Endpoint</th>
              <th style={{ width: '20%' }}>Access Level</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Management</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-4">
                    <div className="avatar" style={{ backgroundColor: 'var(--text-main)', width: '40px', height: '40px', borderRadius: '10px', fontSize: '14px' }}>
                      {u.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '15px', display: 'block' }}>{u.full_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '500' }}>Joined {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                    <Mail size={14} color="var(--text-dim)" />
                    {u.email}
                  </div>
                </td>
                <td>{getRoleBadge(u.role)}</td>
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em' }}>Provision Account</h2>
              <button onClick={() => setShowModal(false)} className="logout-btn"><X size={20} /></button>
            </div>
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
      )}
    </div>
  );
};

export default AdminUsers;
