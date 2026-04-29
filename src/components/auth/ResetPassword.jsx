/*
 * ResetPassword.jsx — Reset Password Page
 *
 * This page is accessed via the link sent in the forgot-password email.
 * URL format: /reset-password?token=abc123-uuid
 *
 * Flow:
 *   1. Page loads → reads token from URL query parameter
 *   2. If no token found → shows "Invalid reset link" message
 *   3. User enters new password + confirm password
 *   4. Validates passwords match and are at least 6 chars
 *   5. Calls backend with token + new password
 *   6. Backend validates token is not expired (1 hour limit)
 *   7. Backend updates password hash in database
 *   8. Shows success → auto-redirects to login after 3 seconds
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../../api';

export default function ResetPassword() {

  /*
   * useSearchParams — reads URL query parameters
   * e.g. from URL: /reset-password?token=abc123
   * searchParams.get('token') returns "abc123"
   */
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); /* The reset token from the email link */

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* done — true after password is successfully reset */
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /*
   * match — checks if passwords match in real-time
   * null  = confirm field is empty (don't show any indicator)
   * true  = passwords match (show green checkmark)
   * false = passwords don't match (show red error)
   */
  const match = confirm.length === 0 ? null : newPassword === confirm;

  /*
   * handleSubmit — validates and submits new password
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      await authApi.resetPassword(token, newPassword);
      setDone(true);
      /* Auto-redirect to login after 3 seconds */
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || msg?.error || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  };

  /*
   * If no token in URL → show error immediately
   * This happens if someone navigates to /reset-password directly
   */
  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <p className="text-3xl mb-3">🔗</p>
        <p className="font-semibold text-gray-800 mb-2">Invalid reset link</p>
        <p className="text-sm text-gray-500 mb-5">This link is missing or invalid.</p>
        <Link to="/forgot-password" className="btn-primary text-sm py-2 px-6">Request New Link</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl g-primary flex items-center justify-center text-white font-black text-xl mx-auto mb-2">C</div>
          <span className="g-text font-black text-2xl">ConnectSphere</span>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Set new password</h2>
          <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>

          {/* Success view — shown after password is reset */}
          {done ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">✅</p>
              <p className="font-semibold text-gray-800 mb-1">Password reset!</p>
              <p className="text-sm text-gray-500 mb-1">Your password has been updated successfully.</p>
              <p className="text-xs text-gray-400 mt-2">Redirecting to login…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* New password field */}
                <div>
                  <label className="section-label block mb-1.5">New Password</label>
                  <div className="relative">
                    <input className="input-field pr-10" type={showNew ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showNew ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Confirm password field with real-time match indicator */}
                <div>
                  <label className="section-label block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    {/*
                     * Border color changes based on match state:
                     * match=false → red border
                     * match=true  → green border
                     * match=null  → default border
                     */}
                    <input
                      className={`input-field pr-10 ${match === false ? 'border-red-400 focus:border-red-400' : match === true ? 'border-green-400 focus:border-green-400' : ''}`}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirm} onChange={e => setConfirm(e.target.value)} required />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {/* Real-time password match feedback */}
                  {match === false && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                  {match === true  && <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>}
                </div>

                {/* Submit disabled if loading OR passwords don't match */}
                <button className="btn-primary w-full py-2.5" type="submit" disabled={loading || match === false}>
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
