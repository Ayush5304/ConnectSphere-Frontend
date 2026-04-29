/*
 * OAuth2Callback.jsx — Google OAuth2 Redirect Handler
 *
 * This page handles the redirect after Google login.
 *
 * Full Google OAuth2 Flow:
 *   1. User clicks "Continue with Google" on Login page
 *   2. Browser goes to: localhost:8080/oauth2/authorization/google
 *   3. Google shows its login page
 *   4. User logs in with Google
 *   5. Google redirects to: localhost:8080/login/oauth2/code/google
 *   6. auth-service OAuth2SuccessHandler runs:
 *      - Gets user info from Google (email, name, picture)
 *      - Creates or finds user in database
 *      - Generates JWT token
 *      - Redirects to: localhost:3000/oauth2/callback?token=xxx&userId=xxx&...
 *   7. THIS component runs — reads URL params, saves user, goes to feed
 *
 * This component is just a "landing page" for the OAuth2 redirect.
 * It runs once, saves the data, and immediately navigates away.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function OAuth2Callback() {

  /*
   * useSearchParams — reads all URL query parameters
   * The backend sends: ?token=xxx&userId=xxx&username=xxx&role=xxx&email=xxx
   */
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  /*
   * useEffect with empty [] — runs ONCE when component mounts
   * Reads all the data from URL params sent by the backend
   * If token and userId exist → login and go to feed
   * If missing → show error and redirect to login after 3 seconds
   */
  useEffect(() => {
    /* Extract all user data from URL query parameters */
    const token          = searchParams.get('token');
    const userId         = searchParams.get('userId');
    const username       = searchParams.get('username');
    const role           = searchParams.get('role');
    const email          = searchParams.get('email') || '';
    const fullName       = searchParams.get('fullName') || '';
    const profilePicture = searchParams.get('profilePicture') || '';

    if (token && userId) {
      /* Save user to localStorage and React context — same as normal login */
      login({ token, userId, username, role, email, fullName, profilePicture });
      navigate('/'); /* Go to feed */
    } else {
      /* Something went wrong with Google OAuth2 */
      setError('OAuth sign-in failed. Please try again.');
      setTimeout(() => navigate('/login'), 3000);
    }
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card p-10 text-center max-w-sm w-full">
        {error ? (
          /* Error state — shown if OAuth2 failed */
          <>
            <p className="text-2xl mb-3">⚠️</p>
            <p className="text-red-500 font-medium">{error}</p>
            <p className="text-gray-400 text-sm mt-1">Redirecting to login…</p>
          </>
        ) : (
          /* Loading state — shown briefly while processing */
          <>
            <div className="w-10 h-10 g-primary rounded-full flex items-center justify-center text-white font-black text-lg mx-auto mb-4">C</div>
            <p className="text-gray-700 font-semibold">Signing you in…</p>
            <p className="text-gray-400 text-sm mt-1">Please wait a moment</p>
          </>
        )}
      </div>
    </div>
  );
}
