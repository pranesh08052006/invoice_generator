import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Mail, Lock, AlertTriangle, X } from 'lucide-react';
import logo from '../assets/logo.png';
import API_BASE_URL from '../config';

const Login = ({ login, sessionExpiredMsg, onDismissSessionMsg }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Interactive UI states for smooth SaaS micro-animations
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      const response = await axios.post(`${API_BASE_URL}/auth/login`, formData);
      login(response.data.user, response.data.access_token);
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
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
              Welcome back
            </h2>

            <p style={{ 
              color: '#6b7280', 
              fontSize: '14px',
              margin: 0
            }}>
              Sign in to manage your enterprise billing.
            </p>
          </div>

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
                  placeholder="you@company.com"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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

            {/* Error Message */}
            {error && (
              <div style={{ 
                width: '100%', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '20px',
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}>
                {error}
              </div>
            )}

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
          <a 
            href="#" 
            style={{ 
              color: 'var(--primary-color)', 
              fontWeight: '600', 
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            Contact Admin
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;

