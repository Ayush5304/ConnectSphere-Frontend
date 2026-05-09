import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SearchBar from './search/SearchBar';
import Avatar from './ui/Avatar';
import { notificationApi } from '../api';

const BellIcon = ({ size = 21 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const SearchIcon = ({ size = 21 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const HomeIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 10.5 9-7 9 7" />
    <path d="M5 10v10h14V10" />
  </svg>
);


const ReelsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="m10 9 5 3-5 3V9Z" />
  </svg>
);

const MessageIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4 20-7Z" />
  </svg>
);

const ShieldIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1 4 4.5v6.2c0 5.1 3.4 9.9 8 11.3 4.6-1.4 8-6.2 8-11.3V4.5L12 1Z" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId = user?.userId ?? user?.id;

  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const notifRef = useRef();
  const menuRef = useRef();

  useEffect(() => {
    if (!user || !currentUserId || user.role === 'GUEST' || user.role === 'ADMIN') return;

    const refreshUnread = () => notificationApi.getUnreadCount(currentUserId)
      .then(({ data }) => setUnread(data.count || 0))
      .catch(() => {});

    refreshUnread();
    const poll = setInterval(refreshUnread, 7000);
    window.addEventListener('focus', refreshUnread);

    const stream = null;

    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', refreshUnread);
      if (stream) stream.close();
    };
  }, [user, currentUserId]);

  useEffect(() => {
    const close = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    setShowNotif(false);
    setShowMenu(false);
    setMobileSearch(false);
  }, [location]);

  const openNotifs = async () => {
    if (!user || showNotif) {
      setShowNotif(false);
      return;
    }
    try {
      const { data } = await notificationApi.getForUser(currentUserId);
      const items = data || [];
      setNotifs(items);
      setUnread(0);
      items.filter(n => !n.read && !n.isRead).forEach(n =>
        notificationApi.markRead(n.notificationId).catch(() => {})
      );
    } catch {}
    setShowNotif(true);
  };

  const hideSearch = ['/login', '/register', '/admin'].includes(location.pathname);
  const navIconClass = ({ isActive }) =>
    `w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isActive ? 'text-black bg-neutral-100' : 'text-neutral-700 hover:bg-neutral-100'}`;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-200">
        <div className={hideSearch ? 'w-full px-5 sm:px-8' : 'page-container'}>
          <div className="h-16 flex items-center gap-4">
            <Link to={user?.role === 'ADMIN' ? '/admin' : '/'} className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl g-primary flex items-center justify-center text-white font-black text-base shadow-sm">C</div>
              <span className="font-black text-xl tracking-tight text-neutral-950 hidden sm:block">ConnectSphere</span>
            </Link>

            {!hideSearch && (
              <div className="flex-1 max-w-[360px] mx-auto hidden md:block">
                <SearchBar />
              </div>
            )}

            <div className={hideSearch ? 'flex-1' : 'flex-1 md:hidden'} />

            <div className="flex items-center gap-1.5">
              {!hideSearch && (
                <button
                  type="button"
                  onClick={() => setMobileSearch(v => !v)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-100 md:hidden"
                  aria-label="Search"
                >
                  <SearchIcon />
                </button>
              )}

              {user ? (
                <>
                  {user.role !== 'ADMIN' && (
                    <NavLink to="/" className={navIconClass} aria-label="Home">
                      <HomeIcon />
                    </NavLink>
                  )}

                  {user.role === 'ADMIN' && (
                    <Link to="/admin" className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-full bg-rose-50 text-rose-600 font-bold text-xs hover:bg-rose-100">
                      <ShieldIcon size={14} />
                      Admin
                    </Link>
                  )}

                  {user.role !== 'GUEST' && (
                    <div className="relative" ref={notifRef}>
                      <button
                        type="button"
                        onClick={() => navigate('/notifications')}
                        className="relative w-10 h-10 rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-100"
                        aria-label="Notifications"
                      >
                        <BellIcon />
                        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
                      </button>

                      {showNotif && (
                        <div className="dropdown absolute right-0 top-12 w-[min(390px,calc(100vw-24px))] overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                            <span className="font-bold text-sm">Notifications</span>
                            <button
                              type="button"
                              onClick={() => {
                                notificationApi.markAllRead(currentUserId).catch(() => {});
                                setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                              }}
                              className="text-xs font-bold text-blue-500 hover:text-blue-600"
                            >
                              Mark all read
                            </button>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {notifs.length === 0 ? (
                              <div className="py-10 text-center">
                                <p className="text-sm font-semibold text-neutral-500">No notifications yet</p>
                                <p className="text-xs text-neutral-400 mt-1">Activity will appear here.</p>
                              </div>
                            ) : notifs.map(n => {
                              const unreadItem = !n.read && !n.isRead;
                              const isBroadcast = n.type === 'GLOBAL';
                              return (
                                <div key={n.notificationId} className={`flex gap-3 px-4 py-3 border-b border-neutral-50 hover:bg-neutral-50 ${unreadItem ? 'bg-blue-50/45' : ''}`}>
                                  <div className={`avatar w-9 h-9 text-xs ${isBroadcast ? 'g-primary' : ''}`}>{isBroadcast ? 'C' : String(n.type || 'N')[0]}</div>
                                  <div className="min-w-0 flex-1">
                                    {isBroadcast && <p className="text-xs font-black uppercase tracking-wide text-blue-500 mb-0.5">ConnectSphere Broadcast</p>}
                                    <p className="text-sm text-neutral-800 leading-snug">{n.message}</p>
                                    <p className="text-xs text-neutral-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                    {n.deepLink && !n.deepLink.endsWith('/') && (
                                      <a href={n.deepLink} className="text-xs font-bold text-blue-500 hover:underline">View</a>
                                    )}
                                  </div>
                                  {unreadItem && <span className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMenu(v => !v)}
                      className="flex items-center gap-2 p-1 rounded-full hover:bg-neutral-100"
                      aria-label="Account menu"
                    >
                      <Avatar user={user} className="w-9 h-9 text-sm" />
                    </button>

                    {showMenu && (
                      <div className="dropdown absolute right-0 top-12 w-56 overflow-hidden py-1">
                        <div className="px-4 py-3 border-b border-neutral-100">
                          <p className="font-bold text-sm truncate">{user.role === 'ADMIN' ? 'Admin Control' : (user.fullName || user.username)}</p>
                          <p className="text-xs text-neutral-500 truncate">{user.role === 'ADMIN' ? 'Monitoring access only' : `@${user.username}`}</p>
                        </div>
                        {user.role === 'ADMIN' ? (
                          <Link to="/admin" className="block px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">Admin dashboard</Link>
                        ) : (
                          <>
                            <Link to={currentUserId ? `/profile/${currentUserId}` : '/'} className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Profile</Link>
                            <Link to="/edit-profile" className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Edit profile</Link>
                            <Link to="/messages" className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Messages</Link>
                            <Link to="/settings" className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Settings and activity</Link>
                          </>
                        )}
                        <hr className="divider my-1" />
                        <button
                          type="button"
                          onClick={() => { logout(); navigate('/login'); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                        >
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-ghost h-9 px-3">Log In</Link>
                  <Link to="/register" className="btn-primary h-9 px-4">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileSearch && !hideSearch && (
          <div className="md:hidden px-4 pb-3 pt-1 border-t border-neutral-100 bg-white">
            <SearchBar />
          </div>
        )}
      </nav>

      {user && !(user.role === 'ADMIN' && location.pathname === '/admin') && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 md:hidden">
          <div className={`${user.role === 'ADMIN' ? 'grid-cols-2' : 'grid-cols-6'} grid h-14`}>
            {user.role === 'ADMIN' ? (
              <>
                <Link to="/admin" className="flex items-center justify-center gap-2 text-rose-600 text-xs font-black" aria-label="Admin dashboard">
                  <ShieldIcon size={20} />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); navigate('/login'); }}
                  className="flex items-center justify-center text-rose-600 text-xs font-black"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/" className="flex items-center justify-center text-neutral-800" aria-label="Home">
                  <HomeIcon size={23} />
                </NavLink>
                <NavLink to="/reels" className="flex items-center justify-center text-neutral-800" aria-label="Reels">
                  <ReelsIcon size={23} />
                </NavLink>
                <NavLink to="/messages" className="flex items-center justify-center text-neutral-800 relative" aria-label="Messages">
                  <MessageIcon size={23} />
                </NavLink>
                {!hideSearch && (
                  <button type="button" onClick={() => setMobileSearch(v => !v)} className="flex items-center justify-center text-neutral-800" aria-label="Search">
                    <SearchIcon size={23} />
                  </button>
                )}
                <button type="button" onClick={() => navigate('/notifications')} className="relative flex items-center justify-center text-neutral-800" aria-label="Notifications">
                  <BellIcon size={23} />
                  {unread > 0 && <span className="notif-dot top-2 right-[calc(50%-16px)]">{unread > 9 ? '9+' : unread}</span>}
                </button>
                <NavLink to="/explore" className="flex items-center justify-center text-neutral-800" aria-label="Explore">
                  <SearchIcon size={23} />
                </NavLink>
                <Link to={currentUserId ? `/profile/${currentUserId}` : '/'} className="flex items-center justify-center" aria-label="Profile">
                  <Avatar user={user} className="w-7 h-7 text-xs" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

