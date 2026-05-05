import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi, postApi, notificationApi, commentApi, searchApi, hasValidToken } from '../../api';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'overview', label: 'Dashboard', path: '/admin' },
  { id: 'users', label: 'Users Management', path: '/admin/users' },
  { id: 'posts', label: 'Posts Management', path: '/admin/posts' },
  { id: 'comments', label: 'Comments Moderation', path: '/admin/comments' },
  { id: 'reports', label: 'Reports', path: '/admin/reports' },
  { id: 'broadcast', label: 'Notifications', path: '/admin/notifications' },
  { id: 'stories', label: 'Stories', path: '/admin/stories' },
  { id: 'trends', label: 'Hashtags / Trends', path: '/admin/trends' },
  { id: 'analytics', label: 'Analytics', path: '/admin/analytics' },
  { id: 'settings', label: 'Settings', path: '/admin/settings' },
];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function initials(value) {
  return (value || 'A').trim().charAt(0).toUpperCase();
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function StatCard({ label, value, tone, detail }) {
  return (
    <div className={cx('admin-glass admin-lift p-5', tone)}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60 font-bold">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-4xl font-black text-white tracking-tight">{value ?? 0}</p>
        <span className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.75)]" />
        </span>
      </div>
      {detail && <p className="mt-3 text-xs text-white/55">{detail}</p>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="admin-glass p-10 text-center text-white/55 text-sm">
      {text}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [reportedPosts, setReportedPosts] = useState([]);
  const [reportedComments, setReportedComments] = useState([]);
  const [reportedUsers, setReportedUsers] = useState([]);
  const [trending, setTrending] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notificationCount, setNotificationCount] = useState(0);
  const [globalMsg, setGlobalMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    refreshAll();
  }, [user, navigate]);

  const refreshAll = async () => {
    if (!hasValidToken()) {
      setNotice('Your admin session has expired. Please log in as admin again.');
      logout();
      navigate('/login', { replace: true });
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      const [
        authAnalytics,
        postAnalytics,
        usersResult,
        postsResult,
        commentsResult,
        postReports,
        commentReports,
        userReports,
        hashtagsResult,
      ] = await Promise.allSettled([
        authApi.authAnalytics(),
        postApi.adminAnalytics(),
        authApi.getAllUsers(),
        postApi.adminGetAll(),
        commentApi.adminGetAll(),
        postApi.adminGetReported(),
        commentApi.adminGetReported(),
        authApi.getReportedUsers(),
        searchApi.getTrendingAdmin(20),
      ]);

      setAnalytics({
        ...(authAnalytics.status === 'fulfilled' ? authAnalytics.value.data : {}),
        ...(postAnalytics.status === 'fulfilled' ? postAnalytics.value.data : {}),
      });
      if (usersResult.status === 'fulfilled') setUsers(usersResult.value.data || []);
      if (postsResult.status === 'fulfilled') setPosts(postsResult.value.data || []);
      if (commentsResult.status === 'fulfilled') setComments(commentsResult.value.data || []);
      if (postReports.status === 'fulfilled') setReportedPosts(postReports.value.data || []);
      if (commentReports.status === 'fulfilled') setReportedComments(commentReports.value.data || []);
      if (userReports.status === 'fulfilled') setReportedUsers(userReports.value.data || []);
      if (hashtagsResult.status === 'fulfilled') setTrending(hashtagsResult.value.data || []);
      if (notificationResult.status === 'fulfilled') setNotificationCount(notificationResult.value.data?.count || 0);

      const settled = [
        ['auth analytics', authAnalytics],
        ['post analytics', postAnalytics],
        ['users', usersResult],
        ['posts', postsResult],
        ['comments', commentsResult],
        ['post reports', postReports],
        ['comment reports', commentReports],
        ['user reports', userReports],
        ['hashtags', hashtagsResult],
        ['notifications', notificationResult],
      ];
      const unauthorized = settled.some(([, result]) => result.status === 'rejected' && result.reason?.response?.status === 401);
      if (unauthorized) {
        setNotice('Your admin session expired or is invalid. Please log in with the admin email and password again.');
        logout();
        navigate('/login', { replace: true });
        return;
      }

      const failed = settled.filter(([, result]) => result.status === 'rejected').map(([name]) => name);
      if (failed.length) {
        setNotice(`Could not load: ${failed.join(', ')}. Check that the related backend services are running.`);
      }
    } catch {
      setNotice('Some admin data could not be loaded. Check backend services and gateway.');
    } finally {
      setLoading(false);
    }
  };

  const reportCount = reportedPosts.length + reportedComments.length + reportedUsers.length;
  const activeUsers = useMemo(() => users.filter(u => u.active).length, [users]);
  const suspendedUsers = users.length - activeUsers;
  const deletedPosts = useMemo(() => posts.filter(p => p.deleted).length, [posts]);
  const activeTab = TABS.find(item => item.id === tab) || TABS[0];

  const changeRole = async (userId, role) => {
    await authApi.changeRole(userId, role);
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, role } : u));
  };

  const toggleActive = async (userId, isActive) => {
    await authApi.toggleActive(userId, !isActive);
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, active: !isActive } : u));
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this user account?')) return;
    await authApi.deleteUser(userId);
    setUsers(prev => prev.filter(u => u.userId !== userId));
    setReportedUsers(prev => prev.filter(u => u.userId !== userId));
  };

  const deletePost = async (postId) => {
    await postApi.adminDelete(postId);
    setPosts(prev => prev.filter(p => p.postId !== postId));
    setReportedPosts(prev => prev.filter(p => p.postId !== postId));
  };

  const deleteComment = async (commentId) => {
    await commentApi.adminDelete(commentId);
    setComments(prev => prev.filter(c => c.commentId !== commentId));
    setReportedComments(prev => prev.filter(c => c.commentId !== commentId));
  };

  const clearPostReport = async (postId) => {
    await postApi.adminClearReport(postId);
    setReportedPosts(prev => prev.filter(p => p.postId !== postId));
  };

  const clearCommentReport = async (commentId) => {
    await commentApi.adminClearReport(commentId);
    setReportedComments(prev => prev.filter(c => c.commentId !== commentId));
  };

  const clearUserReport = async (userId) => {
    await authApi.clearUserReport(userId);
    setReportedUsers(prev => prev.filter(u => u.userId !== userId));
  };

  const sendGlobal = async () => {
    if (!globalMsg.trim()) return;
    await notificationApi.sendGlobal(globalMsg);
    setSent(true);
    setGlobalMsg('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="admin-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <style>{`
        .admin-shell {
          background:
            radial-gradient(circle at 12% 12%, rgba(244, 63, 94, 0.32), transparent 30%),
            radial-gradient(circle at 82% 4%, rgba(251, 191, 36, 0.28), transparent 28%),
            radial-gradient(circle at 64% 88%, rgba(59, 130, 246, 0.34), transparent 34%),
            linear-gradient(135deg, #080812 0%, #111827 44%, #15111f 100%);
          color: #fff;
        }
        .admin-glass {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.055));
          box-shadow: 0 24px 80px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
          border-radius: 18px;
        }
        .admin-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 22px; align-items: start; }
        .admin-sidebar { position: sticky; top: 88px; padding: 18px; }
        .admin-side-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 16px; padding: 12px 14px; font-size: 14px; font-weight: 900; color: rgba(255,255,255,.62); transition: background .2s ease, color .2s ease, transform .2s ease; }
        .admin-side-button:hover { color: #fff; background: rgba(255,255,255,.1); transform: translateX(2px); }
        .admin-side-button.is-active { background: #fff; color: #020617; box-shadow: 0 18px 50px rgba(255,255,255,.16); }
        .admin-main { min-width: 0; }
        .admin-lift { transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
        .admin-lift:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.26); box-shadow: 0 32px 90px rgba(0,0,0,.36); }
        @media (max-width: 1024px) {
          .admin-layout { grid-template-columns: 1fr; }
          .admin-sidebar { position: static; }
          .admin-side-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
        }
        @media (max-width: 640px) {
          .admin-side-list { grid-template-columns: 1fr; }
        }
        .admin-orbit { animation: orbitPulse 5s ease-in-out infinite; }
        @keyframes orbitPulse { 0%,100% { transform: scale(1); opacity: .65; } 50% { transform: scale(1.12); opacity: 1; } }
        .admin-sheen::after {
          content: "";
          position: absolute;
          inset: -80% -20%;
          background: linear-gradient(100deg, transparent 35%, rgba(255,255,255,.16), transparent 65%);
          transform: translateX(-60%);
          animation: sheen 7s ease-in-out infinite;
        }
        @keyframes sheen { 0%, 55% { transform: translateX(-60%); } 80%, 100% { transform: translateX(60%); } }
      `}</style>

      <div className="mx-auto max-w-7xl admin-layout">
        <aside className="admin-sidebar admin-glass">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-amber-400 flex items-center justify-center font-black shadow-[0_0_35px_rgba(236,72,153,.36)]">C</div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45 font-black">Admin Service</p>
              <h2 className="font-black text-lg truncate">Control Modules</h2>
            </div>
          </div>
          <div className="admin-side-list space-y-2">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setTab(item.id); navigate(item.path); }}
                className={cx('admin-side-button', tab === item.id && 'is-active')}
              >
                <span>{item.label}</span>
                <span className="text-xs opacity-60">{item.id === 'reports' ? reportCount : item.id === 'users' ? users.length : item.id === 'posts' ? posts.length : item.id === 'comments' ? comments.length : ''}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={refreshAll} className="rounded-2xl bg-white text-slate-950 px-3 py-3 text-xs font-black hover:bg-white/90 transition-colors">
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
            <button onClick={() => { logout(); navigate('/login'); }} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-3 text-xs font-black text-white hover:bg-white/15 transition-colors">
              Logout
            </button>
          </div>
        </aside>
        <main className="admin-main">
        <header className="admin-glass admin-sheen p-5 sm:p-7 mb-6">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-amber-400 flex items-center justify-center font-black shadow-[0_0_45px_rgba(236,72,153,.45)]">
                  C
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50 font-bold">Admin Service</p>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight">ConnectSphere Control Room</h1>
                </div>
              </div>
              <p className="text-white/62 max-w-3xl text-sm sm:text-base">
                Manage users, posts, comments, reports, notifications, stories, and platform analytics from one powerful admin control room.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={refreshAll} className="rounded-2xl bg-white text-slate-950 px-5 py-3 text-sm font-black hover:bg-white/90 transition-colors">
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <a href="http://localhost:8090" target="_blank" rel="noreferrer"
                className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/15 transition-colors">
                Spring Admin Server
              </a>
            </div>
          </div>
        </header>

        {notice && <div className="mb-5 admin-glass p-4 text-sm text-amber-100">{notice}</div>}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Users" value={analytics.totalUsers ?? users.length} detail={`${activeUsers} active, ${suspendedUsers} suspended`} tone="from-pink-500/20" />
          <StatCard label="Total Posts" value={analytics.totalPosts ?? posts.length} detail={`${deletedPosts} deleted, ${analytics.publicPosts ?? 0} public`} tone="from-indigo-500/20" />
          <StatCard label="Open Reports" value={reportCount} detail={`${reportedPosts.length} posts, ${reportedComments.length} comments, ${reportedUsers.length} accounts`} tone="from-rose-500/20" />
          <StatCard label="Daily Active" value={analytics.dailyActiveUsers ?? 0} detail="Logins in the last 24 hours" tone="from-emerald-500/20" />
        </section>

        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-white/42 font-black">Current Module</p>
            <h2 className="text-2xl font-black">{activeTab.label}</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-white/60">Live admin workspace</span>
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-5">
            <div className="admin-glass p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black">Live Moderation Queue</h2>
                <span className="text-xs text-white/45 font-bold uppercase tracking-[0.2em]">Priority first</span>
              </div>
              <div className="space-y-3">
                {[...reportedUsers.slice(0, 2), ...reportedPosts.slice(0, 3), ...reportedComments.slice(0, 3)].length === 0 ? (
                  <EmptyState text="No pending reports. The community is quiet right now." />
                ) : (
                  <>
                    {reportedUsers.slice(0, 2).map(item => <ReportUserCard key={`u-${item.userId}`} user={item} onClear={clearUserReport} onDelete={deleteUser} />)}
                    {reportedPosts.slice(0, 3).map(item => <ReportPostCard key={`p-${item.postId}`} post={item} onClear={clearPostReport} onDelete={deletePost} compact />)}
                    {reportedComments.slice(0, 3).map(item => <ReportCommentCard key={`c-${item.commentId}`} comment={item} onClear={clearCommentReport} onDelete={deleteComment} compact />)}
                  </>
                )}
              </div>
            </div>
            <div className="admin-glass p-5">
              <h2 className="text-xl font-black mb-5">Platform Pulse</h2>
              <div className="relative h-72 rounded-[24px] overflow-hidden bg-black/25 border border-white/10 flex items-center justify-center">
                <div className="admin-orbit absolute h-44 w-44 rounded-full bg-gradient-to-br from-pink-500/55 to-orange-300/40 blur-sm" />
                <div className="admin-orbit absolute h-64 w-64 rounded-full border border-white/10" style={{ animationDelay: '0.4s' }} />
                <div className="relative text-center">
                  <p className="text-6xl font-black">{Math.max(0, 100 - reportCount * 5)}%</p>
                  <p className="text-white/55 text-sm mt-2">Community health score</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <MiniMetric label="Admins" value={analytics.adminCount ?? users.filter(u => u.role === 'ADMIN').length} />
                <MiniMetric label="Guests" value={analytics.guestCount ?? users.filter(u => u.role === 'GUEST').length} />
                <MiniMetric label="Tags" value={trending.length} />
              </div>
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            {reportCount === 0 ? <EmptyState text="No reported posts, comments, or accounts." /> : (
              <>
                {reportedUsers.map(item => <ReportUserCard key={item.userId} user={item} onClear={clearUserReport} onDelete={deleteUser} />)}
                {reportedPosts.map(item => <ReportPostCard key={item.postId} post={item} onClear={clearPostReport} onDelete={deletePost} />)}
                {reportedComments.map(item => <ReportCommentCard key={item.commentId} comment={item} onClear={clearCommentReport} onDelete={deleteComment} />)}
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {users.length === 0 ? <EmptyState text="No users loaded. Press Refresh Data. If it stays empty, restart auth-service and api-gateway, then log in as admin again." /> : (
              users.map(item => (
                <UserCard key={item.userId} user={item} onRole={changeRole} onToggle={toggleActive} onDelete={deleteUser} />
              ))
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {posts.length === 0 ? <EmptyState text="No posts found." /> : posts.map(item => (
              <PostAdminCard key={item.postId} post={item} onDelete={deletePost} />
            ))}
          </div>
        )}

        {tab === 'comments' && (
          <div className="space-y-3">
            {comments.length === 0 ? <EmptyState text="No comments found." /> : comments.map(item => (
              <CommentAdminCard key={item.commentId} comment={item} onDelete={deleteComment} />
            ))}
          </div>
        )}

        {tab === 'trends' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trending.length === 0 ? <EmptyState text="No trending hashtags found." /> : trending.map(item => (
              <div key={item.hashtagId || item.tag} className="admin-glass admin-lift p-5">
                <p className="text-2xl font-black">#{item.tag}</p>
                <p className="mt-2 text-white/50 text-sm">{item.postCount || item.count || 0} associated posts</p>
                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber-300" style={{ width: `${Math.min(100, (item.postCount || item.count || 1) * 12)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'stories' && (
          <EmptyState text="Stories moderation is ready for API integration. Story creation, deletion, and viewer APIs are available from the media service." />
        )}

        {tab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <MiniMetric label="Total Users" value={analytics.totalUsers ?? users.length} />
            <MiniMetric label="Active Users" value={activeUsers} />
            <MiniMetric label="Suspended" value={suspendedUsers} />
            <MiniMetric label="Posts" value={analytics.totalPosts ?? posts.length} />
            <MiniMetric label="Comments" value={analytics.totalComments ?? comments.length} />
            <MiniMetric label="Reports" value={reportCount} />
          </div>
        )}

        {tab === 'settings' && (
          <div className="admin-glass p-6 max-w-2xl">
            <h2 className="text-2xl font-black mb-2">Admin Settings</h2>
            <p className="text-white/60 text-sm">Admin credentials are configured in backend application.yml. Restart auth-service and api-gateway after changing JWT or admin values.</p>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="admin-glass p-6 max-w-2xl">
            <h2 className="text-2xl font-black mb-2">Broadcast Notification</h2>
            <p className="text-white/55 text-sm mb-5">Send a platform-wide message to registered users.</p>
            <textarea
              className="w-full min-h-36 rounded-3xl bg-white/10 border border-white/15 p-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
              placeholder="Write the notification..."
              value={globalMsg}
              onChange={e => setGlobalMsg(e.target.value)}
            />
            <button onClick={sendGlobal}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-5 py-3 text-sm font-black text-white shadow-[0_18px_45px_rgba(236,72,153,.3)] hover:opacity-95 transition-opacity">
              Send Broadcast
            </button>
            {sent && <p className="mt-3 text-sm text-emerald-200 font-bold">Broadcast sent successfully.</p>}
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/8 border border-white/10 p-3 text-center">
      <p className="text-2xl font-black">{value ?? 0}</p>
      <p className="text-[11px] text-white/45 uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
}

function Pill({ children, tone = 'bg-white/10 text-white/70' }) {
  return <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide', tone)}>{children}</span>;
}

function ActionButton({ children, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={cx(
        'rounded-xl px-3 py-2 text-xs font-black transition-colors',
        danger ? 'bg-rose-500/18 text-rose-100 hover:bg-rose-500/28' : 'bg-white/10 text-white/80 hover:bg-white/16'
      )}>
      {children}
    </button>
  );
}

function UserCard({ user, onRole, onToggle, onDelete }) {
  return (
    <div className="admin-glass admin-lift p-5">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500 to-amber-300 flex items-center justify-center font-black text-xl">
          {initials(user.fullName || user.username)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-lg truncate">{user.fullName || user.username}</h3>
            <Pill tone={user.role === 'ADMIN' ? 'bg-pink-500/20 text-pink-100' : 'bg-white/10 text-white/70'}>{user.role}</Pill>
            <Pill tone={user.active ? 'bg-emerald-500/18 text-emerald-100' : 'bg-rose-500/18 text-rose-100'}>{user.active ? 'Active' : 'Suspended'}</Pill>
          </div>
          <p className="text-white/45 text-sm">@{user.username} · {user.email}</p>
          {user.reported && <p className="mt-2 text-rose-100 text-sm">Reported: {user.reportReason}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {user.role !== 'ADMIN' && <ActionButton onClick={() => onRole(user.userId, 'ADMIN')}>Make Admin</ActionButton>}
        {user.role !== 'USER' && <ActionButton onClick={() => onRole(user.userId, 'USER')}>Make User</ActionButton>}
        <ActionButton onClick={() => onToggle(user.userId, user.active)}>{user.active ? 'Suspend' : 'Activate'}</ActionButton>
        <ActionButton onClick={() => onDelete(user.userId)} danger>Delete</ActionButton>
      </div>
    </div>
  );
}

function PostAdminCard({ post, onDelete }) {
  return (
    <div className="admin-glass admin-lift p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <Pill>{post.visibility || 'PUBLIC'}</Pill>
            {post.reported && <Pill tone="bg-rose-500/18 text-rose-100">Reported</Pill>}
            {post.deleted && <Pill tone="bg-slate-500/30 text-slate-100">Deleted</Pill>}
          </div>
          <p className="text-white/55 text-xs font-bold">@{post.username} · {formatDate(post.createdAt)}</p>
        </div>
        <ActionButton onClick={() => onDelete(post.postId)} danger>Remove</ActionButton>
      </div>
      <p className="mt-4 text-white/82 leading-relaxed">{post.content || 'Media-only post'}</p>
      <p className="mt-4 text-white/42 text-xs">{post.likesCount || 0} reactions · {post.commentsCount || 0} comments</p>
    </div>
  );
}

function CommentAdminCard({ comment, onDelete }) {
  return (
    <div className="admin-glass p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-black">@{comment.username} {comment.parentCommentId && <span className="text-white/40 font-medium">reply</span>}</p>
        <p className="text-white/70 text-sm mt-1">{comment.content}</p>
        <p className="text-white/35 text-xs mt-2">Post #{comment.postId} · {formatDate(comment.createdAt)}</p>
      </div>
      <ActionButton onClick={() => onDelete(comment.commentId)} danger>Delete</ActionButton>
    </div>
  );
}

function ReportUserCard({ user, onClear, onDelete }) {
  return (
    <div className="admin-glass p-4">
      <p className="text-xs text-rose-100 font-black uppercase tracking-[0.2em]">Account Report</p>
      <h3 className="text-lg font-black mt-1">{user.fullName || user.username}</h3>
      <p className="text-white/45 text-sm">@{user.username} · {user.email}</p>
      <p className="text-white/75 text-sm mt-3">{user.reportReason || 'No reason provided.'}</p>
      <div className="mt-4 flex gap-2">
        <ActionButton onClick={() => onClear(user.userId)}>Clear</ActionButton>
        <ActionButton onClick={() => onDelete(user.userId)} danger>Delete Account</ActionButton>
      </div>
    </div>
  );
}

function ReportPostCard({ post, onClear, onDelete, compact }) {
  return (
    <div className="admin-glass p-4">
      <p className="text-xs text-rose-100 font-black uppercase tracking-[0.2em]">Post Report</p>
      <p className={cx('font-black mt-1', compact ? 'text-base' : 'text-lg')}>@{post.username}</p>
      <p className="text-white/70 text-sm mt-2">{post.content || 'Media-only post'}</p>
      <p className="text-rose-100 text-sm mt-2">Reason: {post.reportReason || 'No reason provided.'}</p>
      <div className="mt-4 flex gap-2">
        <ActionButton onClick={() => onClear(post.postId)}>Clear</ActionButton>
        <ActionButton onClick={() => onDelete(post.postId)} danger>Remove Post</ActionButton>
      </div>
    </div>
  );
}

function ReportCommentCard({ comment, onClear, onDelete, compact }) {
  return (
    <div className="admin-glass p-4">
      <p className="text-xs text-rose-100 font-black uppercase tracking-[0.2em]">Comment Report</p>
      <p className={cx('font-black mt-1', compact ? 'text-base' : 'text-lg')}>@{comment.username}</p>
      <p className="text-white/70 text-sm mt-2">{comment.content}</p>
      <p className="text-rose-100 text-sm mt-2">Reason: {comment.reportReason || 'No reason provided.'}</p>
      <div className="mt-4 flex gap-2">
        <ActionButton onClick={() => onClear(comment.commentId)}>Clear</ActionButton>
        <ActionButton onClick={() => onDelete(comment.commentId)} danger>Delete Comment</ActionButton>
      </div>
    </div>
  );
}
