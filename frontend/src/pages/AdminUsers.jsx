import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  UserPlus, Trash2, Shield, User, Mail, Plus, X, Lock, Key, 
  Check, AlertTriangle, Eye, Activity, Calendar, FileText, 
  Users, ShoppingBag, CreditCard, Phone, Building 
} from 'lucide-react';

const AdminUsers = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [myUsers, setMyUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('team'); // 'team' or 'my_users'
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // New User Form State
  const [newUser, setNewUser] = useState({ 
    full_name: '', 
    email: '', 
    password: '', 
    role: user?.role === 'super_admin' ? 'admin' : 'user' 
  });

  // Selected User Detail Modal State
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Super Admin Reassignment & Subscription States
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTargetAdmin, setReassignTargetAdmin] = useState('');
  const [reassignReason, setReassignReason] = useState('Super Admin Reassignment');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState('FREE_TRIAL');
  const [subscriptionPlanLoading, setSubscriptionPlanLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/users`);
      setUsers(response.data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchMyUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/my-users`);
      setMyUsers(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { 
    fetchUsers(); 
    if (user?.role === 'admin') {
      fetchMyUsers();
    }
  }, [user]);

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
      const msg = err?.response?.data?.detail || 'Error creating user. Check if the email is unique.';
      alert(msg);
    }
  };

  const handleDeleteClick = (u) => {
    setDeleteConfirm({ id: u.id, name: u.full_name, email: u.email, role: u.role });
    setDeleteInput('');
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/admin/users/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      setDeleteInput('');
      fetchUsers();
      if (user?.role === 'admin') {
        fetchMyUsers();
      }
    } catch (err) {
      alert('Error removing user. Please try again.');
    } finally {
      setDeleteLoading(false);
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

  const handleViewDetails = async (uid) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/my-users/${uid}/details`);
      setSelectedUserDetail(response.data);
      setSubscriptionPlan(response.data.trial_info.plan_type || 'FREE_TRIAL');
    } catch (err) {
      console.error(err);
      alert('Error fetching user details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateSubscriptionPlan = async (userId) => {
    setSubscriptionPlanLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/users/${userId}/subscription`, {
        plan_type: subscriptionPlan,
        days: 365,
        is_active: true
      });
      alert('Subscription plan updated successfully!');
      const response = await axios.get(`${API_BASE_URL}/admin/my-users/${userId}/details`);
      setSelectedUserDetail(response.data);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error updating subscription plan.');
    } finally {
      setSubscriptionPlanLoading(false);
    }
  };

  const handleToggleAccessInDetails = async (userDetail) => {
    try {
      const updatedAccess = !userDetail.trial_info.has_full_access;
      await axios.patch(`${API_BASE_URL}/admin/users/${userDetail.basic_info.id}/access`, { 
        has_full_access: updatedAccess 
      });
      fetchUsers();
      const response = await axios.get(`${API_BASE_URL}/admin/my-users/${userDetail.basic_info.id}/details`);
      setSelectedUserDetail(response.data);
    } catch (err) {
      console.error(err);
      alert('Error updating access level.');
    }
  };

  const handleSingleTransfer = (userId) => {
    setSelectedUserIds([userId]);
    const systemAdmin = users.find(u => u.is_system_admin);
    const admins = users.filter(u => u.role === 'admin' && !u.is_system_admin);
    if (systemAdmin) {
      setReassignTargetAdmin(systemAdmin.id);
    } else if (admins.length > 0) {
      setReassignTargetAdmin(admins[0].id);
    } else {
      setReassignTargetAdmin('');
    }
    setShowReassignModal(true);
  };

  const handleReassignUsers = async () => {
    if (!reassignTargetAdmin) {
      alert('Please select a target administrator.');
      return;
    }
    setReassignLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/reassign-users`, {
        user_ids: selectedUserIds,
        to_admin_id: reassignTargetAdmin,
        reason: reassignReason
      });
      alert('Users reassigned successfully!');
      setSelectedUserIds([]);
      setShowReassignModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error reassigning users.');
    } finally {
      setReassignLoading(false);
    }
  };

  const systemAdminUser = users.find(u => u.is_system_admin);
  const systemAdminId = systemAdminUser ? systemAdminUser.id : null;

  const getFilteredUsers = () => {
    if (user?.role === 'super_admin') {
      if (activeTab === 'team') {
        return users.filter(u => u.role === 'admin' && !u.is_system_admin);
      } else if (activeTab === 'system_admin') {
        return users.filter(u => u.role === 'user' && (u.assigned_admin_id === systemAdminId || u.assigned_admin_id === 'system_admin' || u.assigned_admin_name === 'System Admin'));
      } else if (activeTab === 'assigned_users') {
        return users.filter(u => u.role === 'user' && u.assigned_admin_id !== systemAdminId && u.assigned_admin_id !== 'system_admin' && u.assigned_admin_name !== 'System Admin');
      } else if (activeTab === 'all_users') {
        return users.filter(u => u.role === 'user');
      }
    } else {
      if (activeTab === 'team') {
        return users.filter(u => u.role === 'user');
      }
    }
    return [];
  };

  const filteredUsers = getFilteredUsers();

  const getTrialDays = (trialEndDate) => {
    if (!trialEndDate) return 0;
    const days = Math.floor((new Date(trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : -1;
  };

  const getRemainingDays = (endDate) => {
    const days = getTrialDays(endDate);
    return days >= 0 ? days : 0;
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

  const getInactivityBadge = (status) => {
    const config = {
      active: { label: 'Active', bg: '#ecfdf5', color: '#059669' },
      less_active: { label: 'Less Active', bg: '#fffbeb', color: '#d97706' },
      inactive: { label: 'Inactive', bg: '#fef2f2', color: '#dc2626' }
    };
    const c = config[status] || config.inactive;
    return (
      <span style={{
        backgroundColor: c.bg,
        color: c.color,
        fontSize: '11px',
        fontWeight: '700',
        padding: '4px 10px',
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          backgroundColor: c.color,
          borderRadius: '50%',
          display: 'inline-block'
        }} />
        {c.label}
      </span>
    );
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <>
      <div className="animate-in">
        <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-main)', margin: 0 }}>
              Team Management
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Control access levels and monitor self-registered users.
            </p>
          </div>
          {activeTab === 'team' && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)' }}>
              <UserPlus size={18} /> Provision New Account
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '28px',
            paddingBottom: '2px'
          }}>
            {user?.role === 'admin' ? (
              <>
                <button
                  onClick={() => setActiveTab('team')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'team' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'team' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Team Members
                </button>
                <button
                  onClick={() => setActiveTab('my_users')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'my_users' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'my_users' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  My Users (Self-Signup)
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab('team'); setSelectedUserIds([]); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'team' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'team' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Managers / Admins
                </button>
                <button
                  onClick={() => { setActiveTab('system_admin'); setSelectedUserIds([]); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'system_admin' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'system_admin' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  System Admin Users
                </button>
                <button
                  onClick={() => { setActiveTab('assigned_users'); setSelectedUserIds([]); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'assigned_users' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'assigned_users' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Assigned Users
                </button>
                <button
                  onClick={() => { setActiveTab('all_users'); setSelectedUserIds([]); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'all_users' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    color: activeTab === 'all_users' ? 'var(--primary-color)' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '15px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  All Users
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--primary-color)' }}>
                <Shield size={20} color="var(--primary-color)" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-color)' }}>
                  {users.filter(u => u.role === 'admin' && !u.is_system_admin).length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active Administrators</div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #10b981' }}>
                <Users size={20} color="#10b981" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                  {users.filter(u => u.role === 'user').length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Total Standard Users</div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #f59e0b' }}>
                <User size={20} color="#f59e0b" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>
                  {(() => { const sa = users.find(u => u.is_system_admin); return sa ? users.filter(u => u.assigned_admin_id === sa.id).length : 0; })()}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>System Pool (Unassigned)</div>
              </div>
            </div>

            {/* Team Table */}
            <div className="table-container shadow-premium">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>User Entity</th>
                    <th style={{ width: '22%' }}>Authentication</th>
                    <th style={{ width: '13%' }}>Access Level</th>
                    <th style={{ width: '13%' }}>Users Under</th>
                    <th style={{ width: '13%' }}>Trial/Access</th>
                    <th style={{ width: '9%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
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
                        {(u.role === 'admin' || u.is_system_admin) && (() => {
                          const count = users.filter(x => x.assigned_admin_id === u.id && x.role === 'user').length;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '32px',
                                height: '28px',
                                padding: '0 10px',
                                borderRadius: '20px',
                                fontSize: '13px',
                                fontWeight: '800',
                                backgroundColor: count > 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(148, 163, 184, 0.15)',
                                color: count > 0 ? 'var(--primary-color)' : 'var(--text-dim)',
                                border: `1px solid ${count > 0 ? 'rgba(37, 99, 235, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`
                              }}>
                                {count}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                                {count === 1 ? 'user' : 'users'}
                              </span>
                            </div>
                          );
                        })()}
                        {u.role === 'super_admin' && (
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
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
                          <button
                            className="logout-btn"
                            onClick={() => handleDeleteClick(u)}
                            title="Deprovision Account"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(activeTab === 'system_admin' || activeTab === 'assigned_users' || activeTab === 'all_users') && (
          <>
            {/* Reassign Panel for Selected Users */}
            {selectedUserIds.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary-color)' }}>
                  {selectedUserIds.length} User(s) Selected
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const admins = users.filter(u => u.role === 'admin' && !u.is_system_admin);
                    if (admins.length > 0) {
                      setReassignTargetAdmin(admins[0].id);
                    } else {
                      setReassignTargetAdmin('');
                    }
                    setShowReassignModal(true);
                  }}
                  style={{ padding: '8px 18px', borderRadius: '6px' }}
                >
                  Transfer Ownership
                </button>
              </div>
            )}

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #10b981' }}>
                <Users size={20} color="#10b981" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                  {filteredUsers.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                  {activeTab === 'system_admin' ? 'System Admin Users' : (activeTab === 'all_users' ? 'All Users' : 'Assigned Users')}
                </div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #3b82f6' }}>
                <Activity size={20} color="#3b82f6" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6' }}>
                  {filteredUsers.filter(u => getTrialDays(u.trial_end_date) >= 0 || u.has_full_access).length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active / Valid Accounts</div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
                <AlertTriangle size={20} color="#ef4444" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444' }}>
                  {filteredUsers.filter(u => getTrialDays(u.trial_end_date) < 0 && !u.has_full_access).length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Trial Expired</div>
              </div>
            </div>

            {/* Users Table */}
            <div className="table-container shadow-premium">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px', paddingLeft: '16px' }}>
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds(filteredUsers.map(u => u.id));
                          } else {
                            setSelectedUserIds([]);
                          }
                        }}
                      />
                    </th>
                    <th>User & Company</th>
                    <th>Contact Info</th>
                    <th>Ownership</th>
                    <th>Trial & Plan</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ paddingLeft: '16px' }}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, u.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                            }
                          }}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-4">
                          <div className="avatar" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff', width: '40px', height: '40px', borderRadius: '10px', fontSize: '14px', fontWeight: '700' }}>
                            {u.full_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '15px', display: 'block' }}>{u.full_name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{u.company_name || 'No Company'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{u.email}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '500', marginTop: '2px' }}>{u.mobile || 'No Phone'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                            {u.assigned_admin_name || 'Unassigned'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                            Source: {u.signup_source || 'INVITED'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '800', 
                            color: u.has_full_access ? 'var(--success)' : (getTrialDays(u.trial_end_date) >= 0 ? 'var(--primary-color)' : '#ef4444'),
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                          }}>
                            {u.has_full_access ? '• Full Access' : (getTrialDays(u.trial_end_date) >= 0 ? `${getTrialDays(u.trial_end_date)} Days Left` : 'Trial Expired')}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                            Plan: {u.plan_status || 'Trial'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          <strong>Login:</strong> {formatDateTime(u.last_login_at || u.last_login)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          <strong>Activity:</strong> {formatDateTime(u.last_activity_at || u.last_activity)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn"
                            onClick={() => handleViewDetails(u.id)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              backgroundColor: 'var(--bg-muted)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-main)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Eye size={14} /> Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No users found in this section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'my_users' && (
          <>
            {/* My Users Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #10b981' }}>
                <Users size={20} color="#10b981" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                  {myUsers.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Assigned SaaS Users</div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #3b82f6' }}>
                <Activity size={20} color="#3b82f6" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6' }}>
                  {myUsers.filter(u => u.status === 'active').length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active in last 7 days</div>
              </div>
              <div className="card" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
                <AlertTriangle size={20} color="#ef4444" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444' }}>
                  {myUsers.filter(u => u.status === 'inactive').length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Inactive Users (30d+)</div>
              </div>
            </div>

            {/* My Users Table */}
            <div className="table-container shadow-premium">
              <table>
                <thead>
                  <tr>
                    <th>User & Company</th>
                    <th>Contact Info</th>
                    <th>Inactivity Status</th>
                    <th>Trial Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-4">
                          <div className="avatar" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff', width: '40px', height: '40px', borderRadius: '10px', fontSize: '14px', fontWeight: '700' }}>
                            {u.full_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '15px', display: 'block' }}>{u.full_name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{u.company_name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{u.email}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '500', marginTop: '2px' }}>{u.mobile}</div>
                      </td>
                      <td>{getInactivityBadge(u.status)}</td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: '800', 
                          color: u.trial_status === 'full_access' ? 'var(--success)' : (u.trial_status === 'active' ? 'var(--primary-color)' : '#ef4444'),
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase'
                        }}>
                          {u.trial_status === 'full_access' ? '• Full Access' : (u.trial_status === 'active' ? 'Active Trial' : 'Trial Expired')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn"
                          onClick={() => handleViewDetails(u.id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            backgroundColor: 'var(--bg-muted)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-main)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Eye size={14} /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {myUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No self-registered users assigned to you yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Provision Account Modal ── */}
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

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '440px', border: '1px solid rgba(239,68,68,0.3)' }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #fef2f2',
              backgroundColor: '#fff5f5',
              borderRadius: '12px 12px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <AlertTriangle size={18} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0 }}>
                  Confirm Account Removal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* User info card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #eaedf3',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '38px', height: '38px',
                  backgroundColor: '#ef4444',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: '800', fontSize: '15px', flexShrink: 0
                }}>
                  {deleteConfirm.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{deleteConfirm.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{deleteConfirm.email}</div>
                </div>
              </div>

              {deleteConfirm.role === 'admin' ? (
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', marginBottom: '8px' }}>
                  This action is <strong>permanent and irreversible</strong>. Deleting this Administrator will automatically reassign all standard users under them to the <strong>System Admin</strong> pool. Their users' invoices, products, and payments will NOT be affected. Only this Administrator's account will be removed.
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', marginBottom: '8px' }}>
                  This action is <strong>permanent and irreversible</strong>. All data associated with this account — including invoices, clients, products, and payments — will be permanently deleted.
                </p>
              )}
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6', marginBottom: '20px' }}>
                To confirm, type <strong style={{ color: '#ef4444', fontFamily: 'monospace' }}>DELETE</strong> in the box below:
              </p>

              <input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deleteInput === 'DELETE') handleDeleteConfirm(); }}
                style={{
                  width: '100%',
                  height: '44px',
                  border: `2px solid ${deleteInput === 'DELETE' ? '#ef4444' : '#eaedf3'}`,
                  borderRadius: '8px',
                  padding: '0 14px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                  color: '#111827',
                  letterSpacing: '0.05em'
                }}
                autoFocus
              />

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}
                  style={{
                    flex: 1,
                    height: '42px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #eaedf3',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteInput !== 'DELETE' || deleteLoading}
                  style={{
                    flex: 1,
                    height: '42px',
                    backgroundColor: deleteInput === 'DELETE' && !deleteLoading ? '#ef4444' : '#fca5a5',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#ffffff',
                    cursor: deleteInput === 'DELETE' && !deleteLoading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={e => { if (deleteInput === 'DELETE' && !deleteLoading) e.currentTarget.style.backgroundColor = '#dc2626'; }}
                  onMouseLeave={e => { if (deleteInput === 'DELETE' && !deleteLoading) e.currentTarget.style.backgroundColor = '#ef4444'; }}
                >
                  {deleteLoading ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      Remove Account
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── User Details Modal ── */}
      {detailModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 190 }}>
          <div className="modal-content" style={{ maxWidth: '580px', padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'var(--primary-color)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '700'
                }}>
                  {selectedUserDetail?.basic_info?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                    {selectedUserDetail?.basic_info?.full_name || 'Loading Details...'}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {selectedUserDetail?.basic_info?.company_name || 'Company Profile'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setDetailModalOpen(false); setSelectedUserDetail(null); }} 
                className="logout-btn"
                style={{ padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', gap: '12px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  border: '3px solid var(--border)', 
                  borderTopColor: 'var(--primary-color)', 
                  borderRadius: '50%', 
                  animation: 'spin 0.8s linear infinite' 
                }} />
                <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>Fetching profile analytics...</span>
              </div>
            ) : selectedUserDetail ? (
              <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '28px' }}>
                
                {/* 1. Basic Info Section */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                    Basic Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #eaedf3' }}>
                      <Mail size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Corporate Email</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}>{selectedUserDetail.basic_info.email}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #eaedf3' }}>
                      <Phone size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Mobile Number</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', display: 'block' }}>{selectedUserDetail.basic_info.mobile || 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ownership Info Section */}
                {selectedUserDetail.ownership_info && (
                  <div style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                      Ownership Info
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #eaedf3' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Assigned Admin</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', display: 'block' }}>
                          {selectedUserDetail.ownership_info.assigned_admin_name || 'Unassigned'}
                        </span>
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #eaedf3' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Signup Source</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', display: 'block' }}>
                          {selectedUserDetail.ownership_info.signup_source || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Trial Info Section */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                    Subscription & Trial
                  </h3>
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #eaedf3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #eaedf3', paddingBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700', textTransform: 'uppercase' }}>Subscription Plan</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '800', display: 'block', marginTop: '2px' }}>
                          {selectedUserDetail.trial_info.plan_type === 'FREE_TRIAL' ? '7-Day SaaS Free Trial' : `${selectedUserDetail.trial_info.plan_type} Plan`}
                        </span>
                      </div>
                      <span style={{
                        backgroundColor: selectedUserDetail.trial_info.trial_status === 'expired' ? '#fef2f2' : '#ecfdf5',
                        color: selectedUserDetail.trial_info.trial_status === 'expired' ? '#dc2626' : '#059669',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        textTransform: 'uppercase'
                      }}>
                        {selectedUserDetail.trial_info.trial_status === 'expired' ? 'Expired' : 'Active'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Remaining Days</span>
                        <span style={{ fontSize: '18px', color: selectedUserDetail.trial_info.trial_status === 'expired' ? '#dc2626' : 'var(--primary-color)', fontWeight: '800', display: 'block', marginTop: '2px' }}>
                          {selectedUserDetail.trial_info.trial_status === 'expired' ? '0 Days' : `${getRemainingDays(selectedUserDetail.trial_info.trial_end_date)} Days`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Start Date:</span>
                          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{new Date(selectedUserDetail.trial_info.trial_start_date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>End Date:</span>
                          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{new Date(selectedUserDetail.trial_info.trial_end_date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Full Access Bypass:</span>
                          <span style={{ color: selectedUserDetail.trial_info.has_full_access ? 'var(--success)' : 'var(--text-dim)', fontWeight: '750' }}>
                            {selectedUserDetail.trial_info.has_full_access ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Usage Stats Section */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                    Usage Analytics
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
                      <FileText size={18} color="var(--primary-color)" style={{ margin: '0 auto 6px' }} />
                      <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_invoices}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Invoices</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
                      <ShoppingBag size={18} color="#10b981" style={{ margin: '0 auto 6px' }} />
                      <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_products}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Products</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
                      <Users size={18} color="#3b82f6" style={{ margin: '0 auto 6px' }} />
                      <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_clients}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Clients</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_quotations}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>Quotations</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_proformas}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>Proformas</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_expenses}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>Expenses</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '8px', padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>{selectedUserDetail.usage_stats.total_payments}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>Payments</span>
                    </div>
                  </div>
                </div>

                {/* 4. Activity Logs Section */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                    Activity Logs
                  </h3>
                  <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #eaedf3', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Last Authentication:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>
                        {formatDateTime(selectedUserDetail.activity_info.last_login)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Last Major Action:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>
                        {formatDateTime(selectedUserDetail.activity_info.last_activity)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Super Admin Management Section */}
                {user?.role === 'super_admin' && (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: 'rgba(37, 99, 235, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(37, 99, 235, 0.15)'
                  }}>
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary-color)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 16px 0' }}>
                      Super Admin Controls
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'block' }}>Full Access Toggle</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bypass all trial validation constraints</span>
                        </div>
                        <button
                          onClick={() => handleToggleAccessInDetails(selectedUserDetail)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: '800',
                            backgroundColor: selectedUserDetail.trial_info.has_full_access ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                            border: `1px solid ${selectedUserDetail.trial_info.has_full_access ? '#ef4444' : 'var(--primary-color)'}`,
                            color: selectedUserDetail.trial_info.has_full_access ? '#ef4444' : 'var(--primary-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {selectedUserDetail.trial_info.has_full_access ? 'Restrict Access' : 'Grant Full Access'}
                        </button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                          Modify Subscription Level
                        </span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <select
                            value={subscriptionPlan}
                            onChange={e => setSubscriptionPlan(e.target.value)}
                            className="input-field"
                            style={{ flex: 1, height: '40px', padding: '0 12px', fontSize: '13px', borderRadius: '8px' }}
                          >
                            <option value="FREE_TRIAL">Free Trial</option>
                            <option value="BASIC">Basic Plan</option>
                            <option value="PREMIUM">Premium Plan</option>
                            <option value="ENTERPRISE">Enterprise Plan</option>
                          </select>
                          <button
                            onClick={() => handleUpdateSubscriptionPlan(selectedUserDetail.basic_info.id)}
                            disabled={subscriptionPlanLoading}
                            className="btn btn-primary"
                            style={{ padding: '0 20px', height: '40px', fontSize: '13px', borderRadius: '8px' }}
                          >
                            {subscriptionPlanLoading ? 'Saving...' : 'Apply Plan'}
                          </button>
                        </div>
                      </div>

                      {user?.role === 'super_admin' && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                            Ownership Control
                          </span>
                          <button
                            onClick={() => handleSingleTransfer(selectedUserDetail.basic_info.id)}
                            className="btn"
                            style={{
                              width: '100%',
                              height: '40px',
                              fontSize: '13px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              color: 'var(--primary-color)',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Transfer Ownership
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No details found for this user.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reassign / Transfer Ownership Modal ── */}
      {showReassignModal && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>Transfer Ownership</h2>
              <button type="button" onClick={() => setShowReassignModal(false)} className="logout-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
                You are about to reassign ownership of <strong>{selectedUserIds.length}</strong> selected user(s) to another administrator.
              </p>
              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label">Select Target Administrator</label>
                <select 
                  className="input-field" 
                  value={reassignTargetAdmin} 
                  onChange={e => setReassignTargetAdmin(e.target.value)}
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  {users.filter(u => u.is_system_admin).map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.full_name} (System Pool)</option>
                  ))}
                  {users.filter(u => u.role === 'admin' && !u.is_system_admin).map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.full_name} ({admin.email})</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: '24px' }}>
                <label className="input-label">Transfer Reason / Audit Note</label>
                <input 
                  placeholder="e.g. Account manager reshuffle" 
                  className="input-field" 
                  value={reassignReason} 
                  onChange={e => setReassignReason(e.target.value)} 
                  required 
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>
              <button 
                onClick={handleReassignUsers} 
                disabled={reassignLoading} 
                className="btn btn-primary w-full" 
                style={{ height: '48px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px' }}
              >
                {reassignLoading ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Transferring...
                  </>
                ) : (
                  <>
                    <Users size={16} /> Confirm Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
