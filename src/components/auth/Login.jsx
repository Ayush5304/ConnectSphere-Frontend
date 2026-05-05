import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authApi, OAUTH_GOOGLE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

const reelCards = [
  { label: 'Stories', title: 'Moments that disappear beautifully', gradient: 'linear-gradient(135deg,#feda75,#d62976)' },
  { label: 'Feed', title: 'Photos, captions, reactions', gradient: 'linear-gradient(135deg,#111827,#4f5bd5)' },
  { label: 'Live', title: 'Signals from your circle', gradient: 'linear-gradient(135deg,#0095f6,#962fbf)' },
];

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const location = useLocation();
  const adminRequested = new URLSearchParams(location.search).get('admin') === '1';
  const [adminMode, setAdminMode] = useState(adminRequested);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setAdminMode(adminRequested);
    if (adminRequested) {
      setOtpMode(false);
      setOtpSent(false);
      setOtp('');
      setError('');
    }
  }, [adminRequested]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { email: form.email.trim(), password: form.password };
      const { data } = await authApi.login(payload);
      if (adminMode && data.role !== 'ADMIN') {
        setError('This account is not an admin account.');
        return;
      }
      login(data);
      navigate(data.role === 'ADMIN' ? '/admin' : '/');
    } catch (err) {
      const msg = err.response?.data;
      const text = typeof msg === 'string' ? msg : msg?.message || msg?.error || '';
      setError(text || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.guestLogin();
      login(data);
      navigate('/');
    } catch {
      setError('Guest login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminMode = () => {
    setAdminMode(true);
    setOtpMode(false);
    setOtpSent(false);
    setOtp('');
    setForm({ email: '', password: '' });
    setError('');
    navigate('/login?admin=1', { replace: false });
  };

  const handleUserPasswordMode = () => {
    setOtpMode(false);
    setAdminMode(false);
    setError('');
    navigate('/login', { replace: true });
  };

  const handleOtpMode = () => {
    setOtpMode(true);
    setAdminMode(false);
    setError('');
    navigate('/login', { replace: true });
  };

  const handleRequestOtp = async () => {
    if (!form.email) {
      setError('Please enter email first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.requestLoginOtp(form.email);
      setOtpSent(true);
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.verifyLoginOtp(form.email, otp);
      login(data);
      navigate(data.role === 'ADMIN' ? '/admin' : '/');
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cinematic-stage">
      <div className="cinematic-shell">
        <section className="cinematic-copy">
          <div className="cinematic-kicker">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(237,73,86,0.9)]" />
            Social universe
          </div>
          <h1 className="cinematic-title">
            Your world,
            <span>in motion.</span>
          </h1>
          <p className="cinematic-subtitle">
            Step into a living timeline where every story feels close, every post has presence, and your circle moves with you.
          </p>
          <div className="cinematic-reel">
            {reelCards.map(card => (
              <div className="reel-card" key={card.label}>
                <div className="reel-card-inner" style={{ '--card-gradient': card.gradient }}>
                  <span className="reel-pill">{card.label}</span>
                  <p>{card.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-content">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="auth-logo g-primary mb-4">C</div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">ConnectSphere</p>
              </div>
              {adminMode && <span className="badge badge-red">Admin mode</span>}
            </div>

            <h2 className="text-4xl font-black tracking-tight text-neutral-950">
              {adminMode ? 'Admin login' : 'Welcome back'}
            </h2>
            <p className="text-neutral-500 text-sm mt-2 mb-7">
              {adminMode ? 'Enter your configured admin email and password.' : 'Sign in and jump back into your feed.'}
            </p>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-start gap-2 font-semibold">
                <span className="mt-0.5">!</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-5">
              <button
                type="button"
                onClick={handleUserPasswordMode}
                className={`auth-tab ${!otpMode && !adminMode ? 'auth-tab-active' : ''}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={handleOtpMode}
                className={`auth-tab ${otpMode ? 'auth-tab-active' : ''}`}
              >
                Email OTP
              </button>
              <Link
                to="/login?admin=1"
                onClick={handleAdminMode}
                className={`auth-tab ${adminMode ? 'auth-tab-active' : ''}`}
              >
                Admin
              </Link>
            </div>

            <form onSubmit={otpMode ? handleVerifyOtp : handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">
                  {adminMode ? 'Admin email' : 'Email'}
                </label>
                <input
                  className="input-field"
                  type="email"
                  placeholder={adminMode ? 'admin@example.com' : 'you@example.com'}
                  value={form.email}
                  onChange={event => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>

              {!otpMode && (
                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">
                    {adminMode ? 'Admin password' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={form.password}
                      onChange={event => setForm({ ...form, password: event.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(value => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-800 transition-colors"
                    >
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="text-right mt-2">
                    <Link to="/forgot-password" className="text-xs text-blue-500 hover:text-blue-600 font-black">Forgot password?</Link>
                  </div>
                </div>
              )}

              {otpMode && (
                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">OTP</label>
                  <div className="flex gap-2">
                    <input
                      className="input-field"
                      type="text"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={event => setOtp(event.target.value)}
                      maxLength={6}
                    />
                    <button type="button" className="btn-outline px-3 whitespace-nowrap" onClick={handleRequestOtp} disabled={loading}>
                      {otpSent ? 'Resend' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              <button className={`btn-primary cinematic-button w-full text-base ${adminMode ? 'from-rose-600' : ''}`} type="submit" disabled={loading}>
                {loading ? 'Signing in...' : (adminMode ? 'Sign in as admin' : (otpMode ? 'Verify and sign in' : 'Sign in'))}
              </button>

              {adminMode && (
                <button
                  type="button"
                  onClick={() => { setAdminMode(false); setForm({ email: '', password: '' }); setError(''); navigate('/login', { replace: true }); }}
                  className="btn-outline cinematic-outline w-full"
                >
                  Back to user login
                </button>
              )}
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 font-black">OR</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <div className="space-y-3">
              <a href={OAUTH_GOOGLE_URL} className="btn-outline cinematic-outline w-full">
                Continue with Google
              </a>
              <button onClick={handleGuest} disabled={loading} className="btn-outline cinematic-outline w-full text-neutral-600">
                Browse as guest
              </button>
            </div>

            <p className="text-center text-sm mt-7 text-neutral-500">
              New here?{' '}
              <Link to="/register" className="text-blue-500 font-black hover:text-blue-600">Create an account</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
