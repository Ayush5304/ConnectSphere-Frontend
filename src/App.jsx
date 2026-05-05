/*
 * App.jsx — Main Application File
 *
 * This is the ROOT component of our entire frontend.
 * It does 3 important things:
 *   1. Wraps the app with AuthProvider — so every component can access logged-in user info
 *   2. Wraps the app with BrowserRouter — enables page navigation without full reload
 *   3. Defines all ROUTES — which URL shows which page/component
 *
 * Route Protection:
 *   - PrivateRoute  → only logged-in users (not guest) can access
 *   - AdminRoute    → only ADMIN role users can access
 *   - GuestRoute    → only logged-OUT users can access (login/register pages)
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import OAuth2Callback from './components/auth/OAuth2Callback';
import Feed from './components/feed/Feed';
import Profile from './components/profile/Profile';
import AdminDashboard from './components/admin/AdminDashboard';
import EditProfile from './components/profile/EditProfile';
import './index.css';

/*
 * PrivateRoute — Protects pages that require login
 *
 * How it works:
 *   - Gets the current user from AuthContext
 *   - If user is null (not logged in) → redirect to /login
 *   - If user is GUEST → redirect to /login (guests have limited access)
 *   - If user is a proper logged-in USER or ADMIN → show the page
 *
 * Used for: /profile, /edit-profile
 */
function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'GUEST') return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
}

/*
 * AdminRoute — Protects pages that only ADMIN can access
 *
 * How it works:
 *   - If not logged in → redirect to /login
 *   - If logged in but NOT admin → redirect to home page /
 *   - If ADMIN → show the page
 *
 * Used for: /admin (Admin Dashboard)
 */
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

/*
 * GuestRoute — Protects login/register pages from logged-in users
 *
 * How it works:
 *   - If user is already logged in (and not a guest) → redirect to home /
 *   - This prevents logged-in users from seeing the login/register pages
 *
 * Used for: /login, /register
 */
function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user && user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user && user.role !== 'GUEST') return <Navigate to="/" replace />;
  return children;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Feed />;
}

function PublicProfileRoute() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Profile />;
}

/*
 * AppRoutes — Defines all the URL routes of the application
 *
 * Route breakdown:
 *   /                    → Feed page (public — anyone can see posts)
 *   /profile/:userId     → Profile page (public — guests can view public profiles)
 *   /forgot-password     → Forgot password page (public)
 *   /reset-password      → Reset password page (public — accessed via email link)
 *   /oauth2/callback     → Google OAuth2 redirect handler (public)
 *   /login               → Login page (only for logged-out users)
 *   /register            → Register page (only for logged-out users)
 *   /edit-profile        → Edit profile page (only logged-in non-guest users)
 *   /admin               → Admin dashboard (only ADMIN role)
 *   *                    → Any unknown URL → redirect to home /
 */
function AppRoutes() {
  return (
    <>
      {/* Navbar is shown on ALL pages */}
      <Navbar />
      <Routes>
        {/* PUBLIC — anyone can view the feed */}
        <Route path="/" element={<HomeRoute />} />

        {/* PUBLIC - guests can view public profiles */}
        <Route path="/profile/:userId" element={<PublicProfileRoute />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth2/callback" element={<OAuth2Callback />} />

        {/* AUTH PAGES — only for non-logged-in users */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        {/* PRIVATE — only registered users (not guest) */}
        <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />

        {/* ADMIN ONLY */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/:section" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Catch-all — any unknown URL goes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

/*
 * App — Root Component
 *
 * Wraps everything with:
 *   1. AuthProvider  — makes user login state available to ALL components
 *   2. BrowserRouter — enables client-side routing (no full page reloads)
 *
 * This is what gets rendered in index.js
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
