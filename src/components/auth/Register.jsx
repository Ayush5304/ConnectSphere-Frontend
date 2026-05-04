import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, OAUTH_GOOGLE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const [form, setForm]       = useState({ username: '', email: '', password: '', fullName: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const strength = form.password.length === 0 ? 0
    : form.password.length < 6 ? 1
    : form.password.length < 10 ? 2
    : /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4 : 3;

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await authApi.requestRegisterOtp(form);
      setOtpStep(true);
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.verifyRegisterOtp(form.email, otp);
      login(data);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'OTP verification failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-indigo-600 flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative z-10 text-center max-w-xs">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-black text-3xl mx-auto mb-6">C</div>
          <h1 className="text-4xl font-black mb-3 tracking-tight">Join ConnectSphere</h1>
          <p className="text-indigo-200 text-base mb-10 leading-relaxed">Connect with millions of people sharing their world every day.</p>
          <ul className="space-y-3 text-left text-sm text-indigo-100">
            {['🚀  Get started in seconds', '🔒  Your data stays private', '🌍  Connect globally', '✨  Discover trending content'].map(t => (
              <li key={t} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 font-medium">{t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl mx-auto mb-3">C</div>
            <span className="font-black text-2xl text-slate-800 tracking-tight">ConnectSphere</span>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Create account</h2>
            <p className="text-slate-400 text-sm mb-6">Join ConnectSphere today — it's free</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {!otpStep ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input className="input-field" type="text" placeholder="Your full name"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value, username: e.target.value.replace(/\s+/g, '').toLowerCase() })}
                  required />
                {form.username && (
                  <p className="text-xs text-slate-400 mt-1">Username: <span className="text-indigo-600 font-semibold">@{form.username}</span></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                <input className="input-field" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input className="input-field pr-10" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">Strength: <span className="font-semibold text-slate-600">{strengthLabel[strength]}</span></p>
                  </div>
                )}
              </div>
              <button className="btn-primary w-full py-2.5 mt-1" type="submit" disabled={loading}>
                {loading ? 'Sending OTP…' : 'Send Signup OTP'}
              </button>
            </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">
                  OTP sent to <strong>{form.email}</strong>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Enter OTP</label>
                  <input className="input-field" type="text" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
                </div>
                <button className="btn-primary w-full py-2.5 mt-1" type="submit" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify OTP & Create Account'}
                </button>
                <button type="button" className="btn-ghost w-full py-2.5" onClick={handleSubmit} disabled={loading}>
                  Resend OTP
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <a href={OAUTH_GOOGLE_URL}
              className="flex items-center justify-center gap-3 w-full border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign up with Google
            </a>

            <p className="text-center text-sm mt-6 text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-800">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
