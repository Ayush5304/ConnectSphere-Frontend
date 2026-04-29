/*
 * AuthContext.jsx — Global Authentication State Manager
 *
 * This file manages WHO IS LOGGED IN across the entire application.
 *
 * Problem it solves:
 *   Without this, every component would need the logged-in user passed
 *   as a prop from parent to child to grandchild — very messy.
 *   With Context, ANY component can directly access the logged-in user.
 *
 * What it stores:
 *   - user object (userId, username, email, role, token, profilePicture etc.)
 *
 * What it provides:
 *   - user    → the currently logged-in user (null if not logged in)
 *   - login() → call this after successful login to save user data
 *   - logout()→ call this to clear user data and log out
 *
 * Data persistence:
 *   - User data is saved in localStorage so it survives page refresh
 *   - On page load, it reads from localStorage to restore the session
 */

import React, { createContext, useContext, useState } from 'react';

/*
 * createContext(null) — Creates the global "box" to store auth data
 * null = default value when no Provider is found above in the tree
 * We name it AuthContext
 */
const AuthContext = createContext(null);

/*
 * AuthProvider — The wrapper component that provides auth data to all children
 *
 * Usage in App.jsx:
 *   <AuthProvider>
 *     <App />       ← everything inside can access auth data
 *   </AuthProvider>
 */
export function AuthProvider({ children }) {

  /*
   * useState with a function (lazy initialization):
   * The function runs ONCE when the app first loads.
   * It checks localStorage for a saved user.
   * If found → parse and return it (user stays logged in after refresh)
   * If not found → return null (no one is logged in)
   */
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  /*
   * login() — Called after successful login or register
   *
   * What it does:
   *   1. Saves JWT token to localStorage (used in every API request header)
   *   2. Saves full user object to localStorage (survives page refresh)
   *   3. Updates React state → all components re-render with new user data
   *
   * userData contains: token, userId, username, email, role, fullName,
   *                    bio, profilePicture
   */
  const login = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  /*
   * logout() — Called when user clicks Logout
   *
   * What it does:
   *   1. Removes token from localStorage (future API calls won't be authenticated)
   *   2. Removes user from localStorage (page refresh won't restore session)
   *   3. Sets user to null → all components re-render showing logged-out state
   */
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  /*
   * AuthContext.Provider — Makes user, login, logout available to ALL child components
   * value={{ user, login, logout }} — these 3 things any component can access
   * {children} — renders everything wrapped inside <AuthProvider>
   */
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/*
 * useAuth — Custom hook to easily access auth data in any component
 *
 * Instead of writing: const { user } = useContext(AuthContext)
 * Any component just writes: const { user } = useAuth()
 *
 * Example usage in any component:
 *   const { user, login, logout } = useAuth();
 */
export const useAuth = () => useContext(AuthContext);
