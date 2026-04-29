/*
 * ForgotPassword.jsx — Forgot Password Page
 *
 * Allows users to request a password reset link via email.
 *
 * Flow:
 *   1. User enters their email address
 *   2. Frontend calls auth-service forgotPassword API
 *   3. Backend generates a unique reset token (UUID)
 *   4. Backend saves token + expiry (1 hour) to database
 *   5. Backend sends email with link: /reset-password?token=xxx
 *   6. Frontend shows "Check your inbox" confirmation
 *
 * The actual password change happens in ResetPassword.jsx
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api';

export default function ForgotPassword() {

  /* email — what user types in the email field */
  const [email, setEmail] = useState('');

  /* sent — true after email is successfully sent, shows confirmation UI */
  const [sent, setSent] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /*
   * handleSubmit — sends reset email request to backend
   * If successful → shows confirmation message with the email address
   * If failed → shows error (e.g. "No account found with this email")
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await authApi.forgotPassword(email);
      setSent(true); /* Switch to confirmation view */
    }
    catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'Failed to send reset email');
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl g-primary flex items-center justify-center text-white font-black text-xl mx-auto mb-2">C</div>
          <span className="g-text font-black text-2xl">ConnectSphere</span>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Forgot password?</h2>
          <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

          {/*
           * Conditional rendering:
           * If sent=true → show confirmation message
           * If sent=false → show the email input form
           */}
          {sent ? (
            /* Confirmation view after email is sent */
            <div className="text-center py-4">
              <p className="text-3xl mb-3">📬</p>
              <p className="font-semibold text-gray-800 mb-1">Check your inbox</p>
              <p className="text-sm text-gray-500 mb-1">We sent a reset link to</p>
              {/* Shows the email they entered */}
              <p className="text-sm font-medium text-violet-600 mb-4">{email}</p>
              <p className="text-xs text-gray-400 mb-5">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
              <Link to="/login" className="btn-primary text-sm py-2 px-6">Back to Login</Link>
            </div>
          ) : (
            /* Email input form */
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="section-label block mb-1.5">Email address</label>
                  <input className="input-field" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button className="btn-primary w-full py-2.5" type="submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <p className="text-center text-sm mt-5 text-gray-500">
                Remember your password?{' '}
                <Link to="/login" className="text-violet-600 font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
