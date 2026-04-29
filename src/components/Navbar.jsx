import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SearchBar from './search/SearchBar';
import { notificationApi } from '../api';

const N_ICON = {
  LIKE: '❤️', COMMENT: '💬', REPLY: '↩️',
  FOLLOW: '👤', MENTION: '@', GLOBAL: '📢', SYSTEM: '🔔'
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unread, setUnread]           = useState(0);
  const [notifs, setNotifs]           = useState([]);
  const [showNotif, setShowNotif]     = useState(false);
  const [showMenu, setShowMenu]       = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const notifRef = useRef();
  const menuRef  = useRef();

  useEffect(() => {
    if (!user || user.role === 'GUEST') return;
    const poll = () => notificationApi.getUnreadCount(user.userId)
      .then(({ data }) => setUnread(data.count || 0)).catch(() => {});
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, [user]);

  useEffect(() => {
    const h = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current  && !menuRef.current.contains(e.target))  setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    setShowNotif(false);
    setShowMenu(false);
    setMobileSearch(false);
  }, [location]);

  const openNotifs = async () => {
    if (showNotif) { setShowNotif(false); return; }
    try {
      const { data } = await notificationApi.getForUser(user.userId);
      setNotifs(data);
      setUnread(0);
      data.filter(n => !n.read).forEach(n =>
        notificationApi.markRead(n.notificationId).catch(() => {})
      );
    } catch {}
    setShowNotif(true);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="page-container">
        <div className="h-14 flex items-center gap-3">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 mr-2">
            <div className="w-8 h-8 rounded-xl g-primary flex items-center justify-center text-white font-black text-sm shadow-sm">C</div>
            <span className="font-black text-lg text-slate-800 hidden sm:block tracking-tight">ConnectSphere</span>
          </Link>

          {/* Desktop Search */}
          <div className="flex-1 max-w-sm hidden md:block">
            <SearchBar />
          </div>

          <div className="flex-1 md:hidden" />

          {/* Right actions */}
          <div className="flex items-center gap-1">

            {/* Mobile search */}
            <button
              onClick={() => setMobileSearch(v => !v)}
              className="btn-ghost w-9 h-9 p-0 rounded-full md:hidden text-slate-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            {user ? (
              <>
                {/* Role badge */}
                <span className={`hidden lg:inline badge text-xs ${
                  user.role === 'ADMIN' ? 'badge-red' :
                  user.role === 'GUEST' ? 'badge-gray' : 'badge-purple'
                }`}>
                  {user.role}
                </span>

                {/* Admin link */}
                {user.role === 'ADMIN' && (
                  <Link to="/admin"
                    className="hidden sm:flex items-center gap-1.5 text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full font-semibold hover:bg-red-100 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    Admin
                  </Link>
                )}

                {/* Notifications */}
                {user.role !== 'GUEST' && (
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={openNotifs}
                      className="relative w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                      {unread > 0 && (
                        <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>
                      )}
                    </button>

                    {showNotif && (
                      <div className="dropdown absolute right-0 top-11 w-80 sm:w-96 z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                          <span className="font-bold text-sm text-slate-800">Notifications</span>
                          {notifs.some(n => !n.read) && (
                            <button
                              onClick={() => {
                                notificationApi.markAllRead(user.userId).catch(() => {});
                                setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                          {notifs.length === 0 ? (
                            <div className="py-10 text-center">
                              <p className="text-2xl mb-2">🔕</p>
                              <p className="text-sm text-slate-400">No notifications yet</p>
                            </div>
                          ) : notifs.map(n => (
                            <div key={n.notificationId}
                              className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-indigo-50/50' : ''}`}
                            >
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-base flex-shrink-0">
                                {N_ICON[n.type] || '🔔'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                                {n.deepLink && !n.deepLink.endsWith('/') && (
                                  <a href={n.deepLink} className="text-xs text-indigo-600 hover:underline font-medium">View →</a>
                                )}
                              </div>
                              {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notificationApi.delete(n.notificationId).catch(() => {});
                                  setNotifs(prev => prev.filter(x => x.notificationId !== n.notificationId));
                                }}
                                className="text-slate-300 hover:text-red-400 text-lg leading-none flex-shrink-0 ml-1 transition-colors"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* User menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(v => !v)}
                    className="flex items-center gap-2 hover:bg-slate-100 rounded-full pl-1 pr-2.5 py-1 transition-colors"
                  >
                    <div className="avatar w-8 h-8 text-sm">
                      {user.profilePicture
                        ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        : user.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-semibold text-slate-700 max-w-[100px] truncate">
                      {user.username}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 hidden sm:block">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="dropdown absolute right-0 top-11 w-52 z-50 overflow-hidden py-1">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="font-semibold text-slate-800 text-sm truncate">{user.fullName || user.username}</p>
                        <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                      </div>
                      <Link to={`/profile/${user.userId}`} onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        My Profile
                      </Link>
                      <Link to="/edit-profile" onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit Profile
                      </Link>
                      {user.role === 'ADMIN' && (
                        <Link to="/admin" onClick={() => setShowMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-sm text-red-600 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                          Admin Panel
                        </Link>
                      )}
                      <hr className="divider my-1" />
                      <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-sm text-red-500 w-full transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm py-1.5 px-4 text-slate-600">Log In</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-4">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search */}
      {mobileSearch && (
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-slate-100">
          <SearchBar />
        </div>
      )}
    </nav>
  );
}
