import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Mail, Lock, AlertTriangle, User, Building, Phone, FileText } from 'lucide-react';
import logo from '../assets/logo.png';
import API_BASE_URL from '../config';
import { Link, useNavigate } from 'react-router-dom';

const Signup = ({ login }) => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus states for input borders
  const [nameFocused, setNameFocused] = useState(false);
  const [companyFocused, setCompanyFocused] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [gstFocused, setGstFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
        full_name: fullName,
        company_name: companyName,
        mobile: mobile,
        email: email,
        password: password,
        gst_number: gstNumber || null
      });

      // Login immediately with the returned token and user data
      login(response.data.user, response.data.access_token);
      navigate('/');
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || 'Signup failed. Please try again.';
      setError(msg);
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
      padding: '40px 24px',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <div className="animate-in" style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '40px' }}>
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
              margin: '0 0 24px 0'
            }}>
              Enterprise billing, simplified.
            </p>

            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '800', 
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0'
            }}>
              Create Account
            </h2>

            <p style={{ 
              color: '#6b7280', 
              fontSize: '14px',
              margin: 0
            }}>
              Start your 7-day free trial. No credit card required.
            </p>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '24px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Full Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  FULL NAME
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: nameFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${nameFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: nameFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>

              {/* Company Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  COMPANY NAME
                </label>
                <div style={{ position: 'relative' }}>
                  <Building size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: companyFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    onFocus={() => setCompanyFocused(true)}
                    onBlur={() => setCompanyFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${companyFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: companyFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Email Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  EMAIL ADDRESS
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
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
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${emailFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: emailFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  MOBILE NUMBER
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: mobileFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="tel"
                    placeholder="9999999999"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    onFocus={() => setMobileFocused(true)}
                    onBlur={() => setMobileFocused(false)}
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${mobileFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: mobileFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
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
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '40px',
                      borderRadius: '8px',
                      border: `1px solid ${passwordFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: passwordFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* GST Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em' }}>
                  GST NUMBER (OPTIONAL)
                </label>
                <div style={{ position: 'relative' }}>
                  <FileText size={16} style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: gstFocused ? 'var(--primary-color)' : '#9ca3af',
                    transition: 'color 0.2s ease'
                  }} />
                  <input
                    type="text"
                    placeholder="22AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={e => setGstNumber(e.target.value)}
                    onFocus={() => setGstFocused(true)}
                    onBlur={() => setGstFocused(false)}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${gstFocused ? 'var(--primary-color)' : '#d1d5db'}`,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                      boxShadow: gstFocused ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px var(--primary-light)',
                opacity: loading ? 0.75 : 1
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.backgroundColor = 'var(--primary-hover)'; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.backgroundColor = 'var(--primary-color)'; }}
            >
              {loading ? (
                <div style={{ 
                  width: '18px', 
                  height: '18px', 
                  border: '2px solid rgba(255,255,255,0.4)', 
                  borderTopColor: '#ffffff', 
                  borderRadius: '50%', 
                  animation: 'spin 0.8s linear infinite' 
                }} />
              ) : 'Sign Up'}
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
          Already have an account?{' '}
          <Link 
            to="/login" 
            style={{ 
              color: 'var(--primary-color)', 
              fontWeight: '600', 
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
