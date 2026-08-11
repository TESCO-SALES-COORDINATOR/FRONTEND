import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, AtSign, ChevronDown, Key } from 'lucide-react';
import { useToast } from '../components/Toast';
import { authApi, setSession, clearSession } from '../api/client';

const Login = () => {
  const navigate = useNavigate();
  const addToast = useToast();
  
  const [role, setRole] = useState('Sales Manager');
  const [email, setEmail] = useState('akash@nexus.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot Password Steps: 0 = Login, 1 = Enter Email, 2 = Enter OTP, 3 = Create Password
  const [forgotStep, setForgotStep] = useState(0);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  // Popup shown when a deactivated Manager/Coordinator tries to log in
  const [blockedMsg, setBlockedMsg] = useState('');

  // Clear any lingering session when redirected here by a logout (e.g. from the Sales Manager app)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('loggedout') === '1') {
      clearSession();
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please fill in all fields', 'warning');
      return;
    }

    // Sales Head has a dedicated web app. Authenticate against the backend (so a
    // changed password takes effect and deactivation is enforced), then open the Head app.
    if (role === 'Sales Head') {
      try {
        const data = await authApi.login('Sales Head', email, password);
        setSession(data.token, data.user);
        addToast('Welcome back, Sales Head!', 'success');
        const base = import.meta.env.VITE_SALES_HEAD_URL || 'http://localhost:5175';
        const u = data.user || {};
        const params = new URLSearchParams({ head: u.name || 'Sales Head', email: u.email || email.trim() });
        window.location.href = `${base}/?${params.toString()}`;
      } catch (err) {
        if (/deactivat/i.test(err.message || '')) {
          clearSession();
          setBlockedMsg(err.message || 'Your account has been deactivated.');
        } else {
          addToast(err.message || 'Invalid email or password', 'error');
        }
      }
      return;
    }

    try {
      const data = await authApi.login(role, email, password);
      setSession(data.token, data.user);
      addToast('Welcome back to Nexus CRM!', 'success');

      // Sales Manager has a dedicated web app — open it instead of the coordinator dashboard
      const activeRole = data.user?.role || role;
      if (activeRole === 'Sales Manager') {
        const base = import.meta.env.VITE_SALES_MANAGER_URL || 'http://localhost:5174';
        const u = data.user || {};
        // Pass the logged-in manager's identity so the Manager app can show their assignments
        const params = new URLSearchParams({ mgr: u.name || '', email: u.email || '' });
        window.location.href = `${base}/?${params.toString()}`;
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      // A deactivated account gets a clear blocking popup; make sure no session lingers
      if (/deactivat/i.test(err.message || '')) {
        clearSession();
        setBlockedMsg(err.message || 'Your account has been deactivated.');
      } else {
        addToast(err.message, 'error');
      }
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      addToast('Please enter your email ID', 'warning');
      return;
    }

    try {
      const data = await authApi.forgotPassword(forgotEmail);
      if (data.devOtp) {
        // Development mode: backend returns OTP since email is not configured
        setGeneratedOtp(data.devOtp);
        addToast(`OTP Sent! Your verification code is ${data.devOtp}`, 'success');
      } else {
        addToast('OTP sent to your email!', 'success');
      }
      setForgotStep(2);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      addToast('Please enter the verification OTP', 'warning');
      return;
    }

    try {
      await authApi.verifyOtp(forgotEmail, otpCode);
      addToast('OTP verified successfully!', 'success');
      setForgotStep(3);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      addToast('Please fill in all password fields', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match!', 'error');
      return;
    }

    try {
      await authApi.resetPassword(forgotEmail, otpCode, newPassword);
      addToast('Password has been reset successfully!', 'success');
      setPassword(newPassword);
      setEmail(forgotEmail);
      setForgotStep(0);
      setForgotEmail('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setGeneratedOtp('');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="login-page-wrapper" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#F8FAFC',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @media (min-width: 1024px) {
          .login-page-wrapper {
            height: 100vh !important;
            min-height: 100vh !important;
            overflow: hidden !important;
          }
          .login-container {
            padding: 1rem 1.5rem !important;
            max-height: calc(100vh - 60px) !important;
          }
          .login-grid {
            gap: 2.5rem !important;
          }
          .left-hero-card {
            padding: 1.75rem 2.25rem !important;
            gap: 1.15rem !important;
          }
          .hero-title {
            font-size: 2rem !important;
          }
          .hero-image-container {
            aspect-ratio: 1.45 !important;
            max-height: 280px !important;
          }
          .right-login-card {
            padding: 2rem !important;
          }
          .right-login-card-header {
            margin-bottom: 1.25rem !important;
          }
        }
      `}</style>

      {/* Account deactivated popup */}
      {blockedMsg && (
        <div
          onClick={() => setBlockedMsg('')}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '16px', padding: '2rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', fontFamily: "'Inter', sans-serif" }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Lock size={26} color="#DC2626" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Account Deactivated</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', color: '#64748B', lineHeight: 1.5 }}>
              {blockedMsg} You cannot access the system. Please contact your Sales Head or administrator.
            </p>
            <button
              onClick={() => setBlockedMsg('')}
              style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.7rem 1.75rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="login-container" style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div className="login-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2.5rem',
          width: '100%',
          alignItems: 'center'
        }}>
          
          {/* Left Panel: Hero Card */}
          <div className="left-hero-card" style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            border: '1px solid rgba(191, 219, 254, 0.4)',
            borderRadius: '1.5rem',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 4px 20px -2px rgba(191, 219, 254, 0.3)'
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1E1B4B', letterSpacing: '-0.3px' }}>
                Nexus CRM
              </span>
            </div>

            {/* Title & Copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h1 className="hero-title" style={{
                fontSize: '2.25rem',
                fontWeight: '800',
                color: '#1E1B4B',
                lineHeight: '1.2',
                letterSpacing: '-1px',
                margin: 0
              }}>
                Manage Sales<br />Workflow Smarter
              </h1>
              <p style={{
                fontSize: '0.875rem',
                color: '#475569',
                lineHeight: '1.6',
                margin: 0
              }}>
                Track leads, appointments, quotations, payments, and project handovers from one powerful CRM platform.
              </p>
            </div>

            {/* Dashboard Mockup Image */}
            <div className="hero-image-container" style={{
              position: 'relative',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 10px 30px -5px rgba(30, 27, 75, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              aspectRatio: '1.45',
              backgroundColor: '#1E1B4B'
            }}>
              <img 
                src="/login_dashboard_preview.png" 
                alt="Nexus CRM Dashboard Preview" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            </div>

            {/* Checklist */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginTop: '0.25rem'
            }}>
              {[
                'Lead Tracking',
                'Appointment Management',
                'Quotation Workflow',
                'Payment Collection',
                'Project Handover'
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: '#1E1B4B'
                  }}
                  // If odd last item spans full row
                  className={idx === 4 ? 'span-full' : ''}
                >
                  <CheckCircle2 size={16} color="#2563EB" fill="#DBEAFE" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Right Panel: Login Form Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%'
          }}>
            <div className="right-login-card" style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 10px 15px -3px rgba(0, 0, 0, 0.03)',
              border: '1px solid #E2E8F0'
            }}>
              {forgotStep === 0 && (
                <>
                  {/* Header */}
                  <div className="right-login-card-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{
                      fontSize: '1.75rem',
                      fontWeight: '800',
                      color: '#0F172A',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      Welcome Back 👋
                    </h2>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#64748B',
                      margin: 0
                    }}>
                      Login to continue managing your sales workflow.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Select Role */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Select Role
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            backgroundColor: '#FFFFFF',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none'
                          }}
                        >
                          <option value="Sales Head">Sales Head</option>
                          <option value="Sales Coordinator">Sales Coordinator</option>
                          <option value="Sales Manager">Sales Manager</option>
                        </select>
                        <ChevronDown size={16} color="#94A3B8" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Email / Employee ID */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Email / Employee ID
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. akash@nexus.com"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <AtSign size={16} color="#94A3B8" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Password
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {showPassword ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#64748B' }}>
                        <input 
                          type="checkbox" 
                          checked={rememberMe} 
                          onChange={(e) => setRememberMe(e.target.checked)} 
                          style={{ accentColor: '#4F46E5' }} 
                        />
                        Remember Me
                      </label>
                      <a 
                        href="#forgot" 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          setForgotEmail(email);
                          setForgotStep(1); 
                        }}
                        style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: '600' }}
                      >
                        Forgot Password?
                      </a>
                    </div>

                    {/* Login Button */}
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.875rem',
                        fontWeight: '700',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                    >
                      Login to Dashboard
                    </button>
                  </form>
                </>
              )}

              {forgotStep === 1 && (
                <>
                  {/* Step 1: Enter Mail ID */}
                  <div className="right-login-card-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{
                      fontSize: '1.75rem',
                      fontWeight: '800',
                      color: '#0F172A',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      Forgot Password? 🔒
                    </h2>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#64748B',
                      margin: 0
                    }}>
                      Enter your email ID to receive a verification OTP code.
                    </p>
                  </div>

                  <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Email Address
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="e.g. akash@nexus.com"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <AtSign size={16} color="#94A3B8" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.875rem',
                        fontWeight: '700',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                    >
                      Send OTP
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                      <a 
                        href="#back" 
                        onClick={(e) => { e.preventDefault(); setForgotStep(0); }}
                        style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: '600' }}
                      >
                        Back to Login
                      </a>
                    </div>
                  </form>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  {/* Step 2: Enter OTP */}
                  <div className="right-login-card-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{
                      fontSize: '1.75rem',
                      fontWeight: '800',
                      color: '#0F172A',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      Verify OTP 🔑
                    </h2>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#64748B',
                      margin: 0
                    }}>
                      We sent a 6-digit verification code to <strong>{forgotEmail}</strong>.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Enter OTP Code
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="e.g. 123456"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            letterSpacing: otpCode ? '4px' : 'normal',
                            fontWeight: otpCode ? '700' : 'normal',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <Key size={16} color="#94A3B8" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.875rem',
                        fontWeight: '700',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                    >
                      Verify OTP
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                      <a 
                        href="#resend" 
                        onClick={(e) => { e.preventDefault(); handleSendOTP(e); }}
                        style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: '600' }}
                      >
                        Resend Code
                      </a>
                      <a 
                        href="#back" 
                        onClick={(e) => { e.preventDefault(); setForgotStep(0); }}
                        style={{ color: '#64748B', textDecoration: 'none', fontWeight: '600' }}
                      >
                        Back to Login
                      </a>
                    </div>
                  </form>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  {/* Step 3: Create New Password */}
                  <div className="right-login-card-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{
                      fontSize: '1.75rem',
                      fontWeight: '800',
                      color: '#0F172A',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      New Password 🛠️
                    </h2>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#64748B',
                      margin: 0
                    }}>
                      Create a strong, new password for your account.
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* New Password */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        New Password
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {showNewPassword ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '0.5rem'
                      }}>
                        Confirm New Password
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          required
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #CBD5E1',
                            outline: 'none',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                          onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.875rem',
                        fontWeight: '700',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                    >
                      Reset Password
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                      <a 
                        href="#back" 
                        onClick={(e) => { e.preventDefault(); setForgotStep(0); }}
                        style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: '600' }}
                      >
                        Back to Login
                      </a>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #E2E8F0',
        padding: '1.5rem',
        backgroundColor: '#FFFFFF'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          fontSize: '0.75rem',
          color: '#64748B',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <span>&copy; 2024 Nexus CRM. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1.5rem', fontWeight: '500' }}>
            <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
            <a href="#security" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Security</a>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
