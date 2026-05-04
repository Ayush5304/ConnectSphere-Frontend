import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SearchBar from './search/SearchBar';
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

const ShieldIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1 4 4.5v6.2c0 5.1 3.4 9.9 8 11.3 4.6-1.4 8-6.2 8-11.3V4.5L12 1Z" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const notifRef = useRef();
  const menuRef = useRef();

  useEffect(() => {
    if (!user || user.role === 'GUEST') return;
    const poll = () => notificationApi.getUnreadCount(user.userId)
      .then(({ data }) => setUnread(data.count || 0))
      .catch(() => {});
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, [user]);

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
      const { data } = await notificationApi.getForUser(user.userId);
      setNotifs(data || []);
      setUnread(0);
      (data || []).filter(n => !n.read).forEach(n =>
        notificationApi.markRead(n.notificationId).catch(() => {})
      );
    } catch {}
    setShowNotif(true);
  };

  const avatarInitial = user?.username?.[0]?.toUpperCase() || 'C';
  const navIconClass = ({ isActive }) =>
    `w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isActive ? 'text-black bg-neutral-100' : 'text-neutral-700 hover:bg-neutral-100'}`;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-200">
        <div className="page-container">
          <div className="h-16 flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl g-primary flex items-center justify-center text-white font-black text-base shadow-sm">C</div>
              <span className="font-black text-xl tracking-tight text-neutral-950 hidden sm:block">ConnectSphere</span>
            </Link>

            <div className="flex-1 max-w-[360px] mx-auto hidden md:block">
              <SearchBar />
            </div>

            <div className="flex-1 md:hidden" />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMobileSearch(v => !v)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-100 md:hidden"
                aria-label="Search"
              >
                <SearchIcon />
              </button>

              {user ? (
                <>
                  <NavLink to="/" className={navIconClass} aria-label="Home">
                    <HomeIcon />
                  </NavLink>

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
                        onClick={openNotifs}
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
                                notificationApi.markAllRead(user.userId).catch(() => {});
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
                            ) : notifs.map(n => (
                              <div key={n.notificationId} className={`flex gap-3 px-4 py-3 border-b border-neutral-50 hover:bg-neutral-50 ${!n.read ? 'bg-blue-50/45' : ''}`}>
                                <div className="avatar w-9 h-9 text-xs">{String(n.type || 'N')[0]}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-neutral-800 leading-snug">{n.message}</p>
                                  <p className="text-xs text-neutral-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                  {n.deepLink && !n.deepLink.endsWith('/') && (
                                    <a href={n.deepLink} className="text-xs font-bold text-blue-500 hover:underline">View</a>
                                  )}
                                </div>
                                {!n.read && <span className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />}
                              </div>
                            ))}
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
                      <div className="avatar w-9 h-9 text-sm">
                        {user.profilePicture
                          ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                          : avatarInitial}
                      </div>
                    </button>

                    {showMenu && (
                      <div className="dropdown absolute right-0 top-12 w-56 overflow-hidden py-1">
                        <div className="px-4 py-3 border-b border-neutral-100">
                          <p className="font-bold text-sm truncate">{user.fullName || user.username}</p>
                          <p className="text-xs text-neutral-500 truncate">@{user.username}</p>
                        </div>
                        <Link to={`/profile/${user.userId}`} className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Profile</Link>
                        <Link to="/edit-profile" className="block px-4 py-2.5 text-sm hover:bg-neutral-50">Edit profile</Link>
                        {user.role === 'ADMIN' && <Link to="/admin" className="block px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">Admin dashboard</Link>}
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

        {mobileSearch && (
          <div className="md:hidden px-4 pb-3 pt-1 border-t border-neutral-100 bg-white">
            <SearchBar />
          </div>
        )}
      </nav>

      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 md:hidden">
          <div className="grid grid-cols-4 h-14">
            <NavLink to="/" className="flex items-center justify-center text-neutral-800" aria-label="Home">
              <HomeIcon size={23} />
            </NavLink>
            <button type="button" onClick={() => setMobileSearch(v => !v)} className="flex items-center justify-center text-neutral-800" aria-label="Search">
              <SearchIcon size={23} />
            </button>
            {user.role === 'ADMIN' ? (
              <Link to="/admin" className="flex items-center justify-center text-rose-600" aria-label="Admin">
                <ShieldIcon size={21} />
              </Link>
            ) : (
              <button type="button" onClick={openNotifs} className="relative flex items-center justify-center text-neutral-800" aria-label="Notifications">
                <BellIcon size={23} />
                {unread > 0 && <span className="notif-dot top-2 right-[calc(50%-16px)]">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}
            <Link to={`/profile/${user.userId}`} className="flex items-center justify-center" aria-label="Profile">
              <div className="avatar w-7 h-7 text-xs">
                {user.profilePicture
                  ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                  : avatarInitial}
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
