import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, OAUTH_GOOGLE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

const reelCards = [
  { label: 'Create', title: 'Post your first frame', gradient: 'linear-gradient(135deg,#0095f6,#4f5bd5)' },
  { label: 'React', title: 'Likes, comments, replies', gradient: 'linear-gradient(135deg,#feda75,#fa7e1e)' },
  { label: 'Discover', title: 'Follow the right people', gradient: 'linear-gradient(135deg,#d62976,#962fbf)' },
];

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '' });
  const [error, setError] = useState('');
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
  const strengthColor = ['', 'bg-rose-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestSignupOtp(form);
      setOtpStep(true);
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const requestSignupOtp = async (payload) => {
    try {
      return await authApi.requestRegisterOtp(payload);
    } catch (err) {
      const msg = err.response?.data;
      const text = typeof msg === 'string' ? msg : msg?.message || msg?.error || '';
      if (!text.toLowerCase().includes('username is already taken')) throw err;

      const uniqueSuffix = Date.now().toString(36);
      const fallbackUsername = `${payload.username || payload.fullName.replace(/\s+/g, '').toLowerCase()}_${uniqueSuffix}`;
      const retryPayload = { ...payload, username: fallbackUsername };
      setForm(prev => ({ ...prev, username: fallbackUsername }));
      return authApi.requestRegisterOtp(retryPayload);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.verifyRegisterOtp(form.email, otp);
      login(data);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cinematic-stage">
      <div className="cinematic-shell">
        <section className="cinematic-copy">
          <div className="cinematic-kicker">
            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(0,149,246,0.9)]" />
            Start your social universe
          </div>
          <h1 className="cinematic-title">
            Join the
            <span>sphere.</span>
          </h1>
          <p className="cinematic-subtitle">
            Build your corner of the sphere with bold moments, honest captions, and conversations that keep unfolding.
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
              <span className="badge badge-blue">{otpStep ? 'Verify' : 'Signup'}</span>
            </div>

            <h2 className="text-4xl font-black tracking-tight text-neutral-950">
              {otpStep ? 'Verify OTP' : 'Create account'}
            </h2>
            <p className="text-neutral-500 text-sm mt-2 mb-7">
              {otpStep ? 'Enter the code sent to your email.' : 'Your profile starts with one clean, beautiful signup.'}
            </p>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-start gap-2 font-semibold">
                <span className="mt-0.5">!</span>
                <span>{error}</span>
              </div>
            )}

            {!otpStep ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">Full name</label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Your full name"
                    value={form.fullName}
                    onChange={event => setForm({ ...form, fullName: event.target.value, username: event.target.value.replace(/\s+/g, '').toLowerCase() })}
                    required
                  />
                  {form.fullName && (
                    <p className="text-xs text-neutral-500 mt-1.5">
                      Display name: <span className="text-blue-500 font-black">{form.fullName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">Email</label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={event => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">Password</label>
                  <div className="relative">
                    <input
                      className="input-field pr-12"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
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
                  {form.password && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : 'bg-neutral-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-neutral-500">
                        Strength: <span className="font-black text-neutral-700">{strengthLabel[strength]}</span>
                      </p>
                    </div>
                  )}
                </div>

                <button className="btn-primary cinematic-button w-full text-base" type="submit" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send signup OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
                  OTP sent to <strong>{form.email}</strong>
                </div>
                <div>
                  <label className="block text-xs font-black text-neutral-600 mb-1.5 uppercase">Enter OTP</label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="6-digit OTP"
                    value={otp}
                    onChange={event => setOtp(event.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
                <button className="btn-primary cinematic-button w-full text-base" type="submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify and create account'}
                </button>
                <button type="button" className="btn-outline cinematic-outline w-full" onClick={handleSubmit} disabled={loading}>
                  Resend OTP
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 font-black">OR</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <a href={OAUTH_GOOGLE_URL} className="btn-outline cinematic-outline w-full">
              Sign up with Google
            </a>

            <p className="text-center text-sm mt-7 text-neutral-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-500 font-black hover:text-blue-600">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
