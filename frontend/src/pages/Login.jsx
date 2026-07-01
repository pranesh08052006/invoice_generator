import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Mail, Lock, AlertTriangle, X, CheckCircle, ShieldCheck } from 'lucide-react';
import logo from '../assets/logo.png';
import API_BASE_URL from '../config';
import { Link } from 'react-router-dom';

const Login = ({ login, sessionExpiredMsg, onDismissSessionMsg }) => {
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password flow states
  const [flowState, setFlowState] = useState('login'); // 'login' | 'forgot' | 'verify' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [forgotEmailFocused, setForgotEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [newPassFocused, setNewPassFocused] = useState(false);
  const [confirmPassFocused, setConfirmPassFocused] = useState(false);

  // Hover states
  const [btnHovered, setBtnHovered] = useState(false);
  const [forgotBtnHovered, setForgotBtnHovered] = useState(false);
  const [verifyBtnHovered, setVerifyBtnHovered] = useState(false);
  const [resetBtnHovered, setResetBtnHovered] = useState(false);
  const [backHovered, setBackHovered] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setForgotSuccess(''); // clear any password reset success message
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      formData.append('platform', 'web');
      const response = await axios.post(`${API_BASE_URL}/auth/login`, formData);
      login(response.data.user, response.data.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email: forgotEmail });
      if (response.data.success) {
        setForgotSuccess('If the email exists, an OTP has been sent. Please check your inbox.');
        setFlowState('verify');
      } else {
        setForgotError(response.data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to send OTP. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-reset-otp`, { email: forgotEmail, otp: otp });
      if (response.data.success && response.data.verified) {
        setForgotSuccess('OTP verified successfully. Please enter a new password.');
        setFlowState('reset');
      } else {
        setForgotError(response.data.message || 'Invalid or expired OTP.');
      }
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Invalid or expired OTP. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        email: forgotEmail,
        otp: otp,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      if (response.data.success) {
        setFlowState('login');
        setError('');
        setForgotSuccess('Password updated successfully. Please sign in with your new password.');
      } else {
        setForgotError(response.data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const navigateToLogin = () => {
    setFlowState('login');
    setForgotError('');
    setForgotSuccess('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 50%, #f4f6fc 0%, #e8eef9 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <div className="animate-in" style={{
        width: '100%',
        maxWidth: '430px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ── Session-Expired Banner ── */}
        {sessionExpiredMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fcd34d',
            animation: 'fadeIn 0.3s ease'
          }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ flex: 1, margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.5', fontWeight: '500' }}>
              {sessionExpiredMsg}
            </p>
            <button
              onClick={onDismissSessionMsg}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', color: '#a16207', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div style={{ padding: '40px 40px 32px 40px' }}>
          {/* Brand & Logo */}
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ 
              width: '54px', 
              height: '54px', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px var(--primary-light)',
              overflow: 'hidden'
            }}>
              <img src={logo} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            </div>
            
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '800', 
              color: 'var(--primary-color)',
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0'
            }}>
              Digital Viyabari
            </h1>
            
            <p style={{ 
              color: '#9ca3af', 
              fontSize: '11px', 
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              margin: '0 0 28px 0'
            }}>
              Enterprise billing, simplified.
            </p>

            <h2 style={{ 
              fontSize: '26px', 
              fontWeight: '800', 
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0'
            }}>
              {flowState === 'login' && 'Welcome back'}
              {flowState === 'forgot' && 'Reset Password'}
              {flowState === 'verify' && 'Verify Code'}
              {flowState === 'reset' && 'Set New Password'}
            </h2>

            <p style={{ 
              color: '#6b7280', 
              fontSize: '14px',
              margin: 0
            }}>
              {flowState === 'login' && 'Sign in to manage your enterprise billing.'}
              {flowState === 'forgot' && 'Enter your email address to receive a secure OTP.'}
              {flowState === 'verify' && `Enter the 6-digit OTP code sent to ${forgotEmail}.`}
              {flowState === 'reset' && 'Create a new password of at least 8 characters.'}
            </p>
          </div>

          {/* Success Banner */}
          {forgotSuccess && (
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px', 
              borderRadius: '8px', 
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#047857',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <CheckCircle size={18} style={{ flexShrink: 0 }} />
              <span>{forgotSuccess}</span>
            </div>
          )}

          {/* Error Banner */}
          {(flowState === 'login' ? error : forgotError) && (
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px', 
              borderRadius: '8px', 
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '20px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{flowState === 'login' ? error : forgotError}</span>
            </div>
          )}

          {/* ── FLOW 1: LOGIN FORM ── */}
          {flowState === 'login' && (
            <form onSubmit={handleSubmit}>
              {/* Email Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#4b5563', 
                  letterSpacing: '0.05em' 
                }}>
                  EMAIL
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: emailFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="email"
                    placeholder=""
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${emailFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: emailFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: '#4b5563', 
                    letterSpacing: '0.05em' 
                  }}>
                    PASSWORD
                  </label>
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      setForgotEmail(email);
                      setForgotError('');
                      setFlowState('forgot');
                    }}
                    style={{ 
                      fontSize: '12px', 
                      color: 'var(--primary-color)', 
                      fontWeight: '600', 
                      textDecoration: 'none' 
                    }}
                    onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                  >
                    Forgot?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: passwordFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder=""
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => passwordFocused && setPasswordFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '44px',
                      borderRadius: '8px',
                      border: `1px solid ${passwordFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: passwordFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute', 
                      right: '14px', 
                      top: '50%',
                      transform: 'translateY(-50%)', 
                      background: 'none',
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#9ca3af',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '20px 0 24px 0'
              }}>
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    accentColor: 'var(--primary-color)',
                    cursor: 'pointer'
                  }}
                />
                <label
                  htmlFor="remember-me"
                  style={{
                    fontSize: '13px',
                    color: '#4b5563',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: '500'
                  }}
                >
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor: loading ? 'var(--primary-light)' : (btnHovered ? 'var(--primary-hover)' : 'var(--primary-color)'),
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: btnHovered ? '0 4px 12px var(--primary-light)' : 'none',
                  transform: btnHovered ? 'translateY(-1px)' : 'none'
                }}
              >
                {loading ? 'SIGNING IN...' : (
                  <>
                    SIGN IN TO DASHBOARD
                    <span style={{ fontSize: '15px', fontWeight: 'bold' }}>→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── FLOW 2: FORGOT PASSWORD REQUEST ── */}
          {flowState === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#4b5563', 
                  letterSpacing: '0.05em' 
                }}>
                  EMAIL ADDRESS
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: forgotEmailFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="email"
                    placeholder=""
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onFocus={() => setForgotEmailFocused(true)}
                    onBlur={() => setForgotEmailFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${forgotEmailFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: forgotEmailFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                onMouseEnter={() => setForgotBtnHovered(true)}
                onMouseLeave={() => setForgotBtnHovered(false)}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor: forgotLoading ? 'var(--primary-light)' : (forgotBtnHovered ? 'var(--primary-hover)' : 'var(--primary-color)'),
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: forgotBtnHovered ? '0 4px 12px var(--primary-light)' : 'none',
                  transform: forgotBtnHovered ? 'translateY(-1px)' : 'none',
                  marginBottom: '20px'
                }}
              >
                {forgotLoading ? 'SENDING OTP...' : 'SEND RESET CODE'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigateToLogin(); }}
                  onMouseEnter={() => setBackHovered(true)}
                  onMouseLeave={() => setBackHovered(false)}
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--primary-color)',
                    textDecoration: backHovered ? 'underline' : 'none'
                  }}
                >
                  ← Back to Sign In
                </a>
              </div>
            </form>
          )}

          {/* ── FLOW 3: VERIFY OTP CODE ── */}
          {flowState === 'verify' && (
            <form onSubmit={handleVerifySubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#4b5563', 
                  letterSpacing: '0.05em' 
                }}>
                  ENTER 6-DIGIT OTP
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: otpFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="text"
                    placeholder=""
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${otpFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '16px',
                      letterSpacing: '0.12em',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      boxShadow: otpFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                onMouseEnter={() => setVerifyBtnHovered(true)}
                onMouseLeave={() => setVerifyBtnHovered(false)}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor: forgotLoading ? 'var(--primary-light)' : (verifyBtnHovered ? 'var(--primary-hover)' : 'var(--primary-color)'),
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: verifyBtnHovered ? '0 4px 12px var(--primary-light)' : 'none',
                  transform: verifyBtnHovered ? 'translateY(-1px)' : 'none',
                  marginBottom: '20px'
                }}
              >
                {forgotLoading ? 'VERIFYING...' : 'VERIFY CODE'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); setFlowState('forgot'); setForgotError(''); }}
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                  ← Resend Email
                </a>

                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigateToLogin(); }}
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--primary-color)',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                  Back to Sign In
                </a>
              </div>
            </form>
          )}

          {/* ── FLOW 4: SET NEW PASSWORD ── */}
          {flowState === 'reset' && (
            <form onSubmit={handleResetSubmit}>
              {/* New Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#4b5563', 
                  letterSpacing: '0.05em' 
                }}>
                  NEW PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: newPassFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder=""
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onFocus={() => setNewPassFocused(true)}
                    onBlur={() => setNewPassFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '44px',
                      borderRadius: '8px',
                      border: `1px solid ${newPassFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: newPassFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(s => !s)}
                    style={{
                      position: 'absolute', 
                      right: '14px', 
                      top: '50%',
                      transform: 'translateY(-50%)', 
                      background: 'none',
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#9ca3af',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#4b5563', 
                  letterSpacing: '0.05em' 
                }}>
                  CONFIRM NEW PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: confirmPassFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder=""
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setConfirmPassFocused(true)}
                    onBlur={() => setConfirmPassFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '48px',
                      paddingLeft: '44px',
                      paddingRight: '44px',
                      borderRadius: '8px',
                      border: `1px solid ${confirmPassFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: confirmPassFocused ? '0 0 0 4px var(--primary-light)' : 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(s => !s)}
                    style={{
                      position: 'absolute', 
                      right: '14px', 
                      top: '50%',
                      transform: 'translateY(-50%)', 
                      background: 'none',
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#9ca3af',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                onMouseEnter={() => setResetBtnHovered(true)}
                onMouseLeave={() => setResetBtnHovered(false)}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor: forgotLoading ? 'var(--primary-light)' : (resetBtnHovered ? 'var(--primary-hover)' : 'var(--primary-color)'),
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: resetBtnHovered ? '0 4px 12px var(--primary-light)' : 'none',
                  transform: resetBtnHovered ? 'translateY(-1px)' : 'none',
                  marginBottom: '20px'
                }}
              >
                {forgotLoading ? 'UPDATING...' : 'UPDATE PASSWORD'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigateToLogin(); }}
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--primary-color)',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                  Cancel and Back to Sign In
                </a>
              </div>
            </form>
          )}
        </div>

        {/* Footer Area */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '18px 40px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#4b5563'
        }}>
          Don't have an account?{' '}
          <Link 
            to="/signup" 
            style={{ 
              color: 'var(--primary-color)', 
              fontWeight: '600', 
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => { e.target.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.target.style.textDecoration = 'none'; }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
