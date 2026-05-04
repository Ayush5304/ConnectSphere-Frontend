import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, OAUTH_GOOGLE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.login(form);
      login(data);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data;
      const text = typeof msg === 'string' ? msg : msg?.message || msg?.error || '';
      setError(text || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  const handleGuest = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await authApi.guestLogin();
      login(data); navigate('/');
    } catch { setError('Guest login failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleRequestOtp = async () => {
    if (!form.email) { setError('Please enter email first.'); return; }
    setLoading(true); setError('');
    try {
      await authApi.requestLoginOtp(form.email);
      setOtpSent(true);
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Unable to send OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await authApi.verifyLoginOtp(form.email, otp);
      login(data);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Invalid OTP.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-transparent">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-6/12 bg-gradient-to-br from-[#10233f] via-[#1b3f63] to-[#2e7a70] flex-col items-center justify-center p-14 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.55) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.45) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />
        <div className="relative z-10 text-center max-w-md">
          <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center font-black text-3xl mx-auto mb-8 backdrop-blur-sm border border-white/20">C</div>
          <h1 className="text-5xl font-black mb-4 tracking-tight">ConnectSphere</h1>
          <p className="text-slate-100 text-2xl mb-2 leading-relaxed">Connect. Share. Discover.</p>
          <p className="text-slate-200/90 text-base mb-10 leading-relaxed">A cleaner social space for stories, posts and meaningful interactions.</p>
          <div className="space-y-3 text-left">
            {['React & Like posts', 'Comment & Reply', 'Real-time Notifications', 'Trending Hashtags', 'Follow Network'].map(f => (
              <div key={f} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2.5 text-sm font-medium backdrop-blur-sm border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[460px]">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 flex items-center justify-center text-white font-black text-xl mx-auto mb-3">C</div>
            <span className="font-black text-2xl text-slate-800 tracking-tight">ConnectSphere</span>
          </div>

          <div className="card p-10">
            <h2 className="text-[2rem] font-bold text-slate-900 mb-1 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-base mb-7">Sign in to your account</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4 text-xs">
              <button type="button" onClick={() => { setOtpMode(false); setError(''); }}
                className={`px-3 py-1.5 rounded-full border ${!otpMode ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-slate-200'}`}>
                Password
              </button>
              <button type="button" onClick={() => { setOtpMode(true); setError(''); }}
                className={`px-3 py-1.5 rounded-full border ${otpMode ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-slate-200'}`}>
                Email OTP
              </button>
            </div>

            <form onSubmit={otpMode ? handleVerifyOtp : handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                <input className="input-field" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              {!otpMode && <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input className="input-field pr-10" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
                <div className="text-right mt-1.5">
                  <Link to="/forgot-password" className="text-xs text-teal-700 hover:text-teal-900 font-semibold">Forgot password?</Link>
                </div>
              </div>}

              {otpMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">OTP</label>
                  <div className="flex gap-2">
                    <input className="input-field" type="text" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                    <button type="button" className="btn-ghost px-3 whitespace-nowrap" onClick={handleRequestOtp} disabled={loading}>
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}

              <button className="btn-primary w-full py-3 mt-1 text-base" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : (otpMode ? 'Verify OTP & Sign In' : 'Sign In')}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="space-y-2.5">
              <a href={OAUTH_GOOGLE_URL}
                className="flex items-center justify-center gap-3 w-full border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </a>
              <button onClick={handleGuest} disabled={loading}
                className="flex items-center justify-center gap-3 w-full border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-500 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Browse as Guest
              </button>
            </div>

            <p className="text-center text-sm mt-6 text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-teal-700 font-semibold hover:text-teal-900">Sign up free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
