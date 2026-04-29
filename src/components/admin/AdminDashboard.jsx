import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, postApi, notificationApi, commentApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const TABS = ['Analytics', 'Users', 'All Posts', 'Manage Comments', 'Reported Posts', 'Global Notification'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Analytics');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [reportedPosts, setReportedPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [globalMsg, setGlobalMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { navigate('/'); return; }
    loadAnalytics();
  }, [user, navigate]);

  useEffect(() => {
    if (tab === 'Users') loadUsers();
    if (tab === 'All Posts') loadAllPosts();
    if (tab === 'Manage Comments') loadComments();
    if (tab === 'Reported Posts') loadReported();
  }, [tab]);

  const loadAnalytics = async () => {
    try {
      const [auth, post] = await Promise.all([authApi.authAnalytics(), postApi.adminAnalytics()]);
      setAnalytics({ ...auth.data, ...post.data });
    } catch {}
  };

  const loadUsers = async () => {
    setLoading(true);
    try { const { data } = await authApi.getAllUsers(); setUsers(data); } catch {}
    setLoading(false);
  };

  const loadAllPosts = async () => {
    setLoading(true);
    try { const { data } = await postApi.adminGetAll(); setPosts(data); } catch {}
    setLoading(false);
  };

  const loadComments = async () => {
    setLoading(true);
    try { const { data } = await commentApi.adminGetAll(); setComments(data); } catch {}
    setLoading(false);
  };

  const loadReported = async () => {
    setLoading(true);
    try { const { data } = await postApi.adminGetReported(); setReportedPosts(data); } catch {}
    setLoading(false);
  };

  const changeRole = async (userId, role) => {
    try {
      await authApi.changeRole(userId, role);
      setUsers(prev => prev.map(u => u.userId === userId ? { ...u, role } : u));
    } catch {}
  };

  const toggleActive = async (userId, isActive) => {
    try {
      await authApi.toggleActive(userId, !isActive);
      setUsers(prev => prev.map(u => u.userId === userId ? { ...u, active: !isActive } : u));
    } catch {}
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this user?')) return;
    try {
      await authApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.userId !== userId));
    } catch {}
  };

  const deletePost = async (postId) => {
    try {
      await postApi.adminDelete(postId);
      setPosts(prev => prev.filter(p => p.postId !== postId));
      setReportedPosts(prev => prev.filter(p => p.postId !== postId));
    } catch {}
  };

  const deleteComment = async (commentId) => {
    try {
      await commentApi.adminDelete(commentId);
      setComments(prev => prev.filter(c => c.commentId !== commentId));
    } catch {}
  };

  const clearReport = async (postId) => {
    try {
      await postApi.adminClearReport(postId);
      setReportedPosts(prev => prev.filter(p => p.postId !== postId));
    } catch {}
  };

  const sendGlobal = async () => {
    if (!globalMsg.trim()) return;
    try {
      await notificationApi.sendGlobal(globalMsg);
      setSent(true);
      setGlobalMsg('');
      setTimeout(() => setSent(false), 3000);
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">🛡️ Admin Dashboard</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t
              ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Analytics */}
      {tab === 'Analytics' && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: analytics.totalUsers, color: 'blue' },
            { label: 'Active Users', value: analytics.activeUsers, color: 'green' },
            { label: 'Admin Users', value: analytics.adminCount, color: 'red' },
            { label: 'Guest Users', value: analytics.guestCount, color: 'gray' },
            { label: 'Total Posts', value: analytics.totalPosts, color: 'purple' },
            { label: 'Public Posts', value: analytics.publicPosts, color: 'indigo' },
            { label: 'Reported Posts', value: analytics.reportedPosts, color: 'orange' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl shadow p-5 text-center">
              <p className={`text-3xl font-bold text-${color}-600`}>{value ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === 'Users' && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {loading ? <p className="p-4 text-gray-400">Loading...</p> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {u.fullName || u.username}
                      <span className="block text-xs text-gray-400">@{u.username}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-600' :
                        u.role === 'USER' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                        {u.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.role !== 'ADMIN' && <button onClick={() => changeRole(u.userId, 'ADMIN')} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Admin</button>}
                        {u.role !== 'USER' && <button onClick={() => changeRole(u.userId, 'USER')} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">User</button>}
                        {u.role !== 'GUEST' && <button onClick={() => changeRole(u.userId, 'GUEST')} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Guest</button>}
                        <button onClick={() => toggleActive(u.userId, u.active)}
                          className={`text-xs px-2 py-1 rounded ${u.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          {u.active ? 'Suspend' : 'Activate'}
                        </button>
                        <button onClick={() => deleteUser(u.userId)}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* All Posts */}
      {tab === 'All Posts' && (
        <div className="space-y-3">
          {loading ? <p className="text-gray-400">Loading...</p> :
           posts.length === 0 ? <p className="text-center text-gray-400 py-8">No posts found.</p> :
           posts.map(p => (
            <div key={p.postId} className="bg-white rounded-xl shadow p-4 flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-semibold text-gray-800 text-sm">
                  @{p.username}
                  <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">{p.visibility}</span>
                  {p.reported && <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">⚠️ Reported</span>}
                  {p.deleted && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Deleted</span>}
                </p>
                <p className="text-gray-600 text-sm mt-1 line-clamp-2">{p.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(p.createdAt).toLocaleString()} · 👍{p.likesCount} 💬{p.commentsCount}</p>
              </div>
              <button onClick={() => deletePost(p.postId)}
                className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 flex-shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manage Comments */}
      {tab === 'Manage Comments' && (
        <div className="space-y-3">
          {loading ? <p className="text-gray-400">Loading...</p> :
           comments.length === 0 ? <p className="text-center text-gray-400 py-8">No comments found.</p> :
           comments.map(c => (
            <div key={c.commentId} className="bg-white rounded-xl shadow p-4 flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-semibold text-gray-800 text-sm">@{c.username}
                  {c.parentCommentId && <span className="ml-2 text-xs text-gray-400">↩ Reply</span>}
                </p>
                <p className="text-gray-600 text-sm mt-1">{c.content}</p>
                <p className="text-xs text-gray-400 mt-1">Post #{c.postId} · {new Date(c.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => deleteComment(c.commentId)}
                className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 flex-shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reported Posts */}
      {tab === 'Reported Posts' && (
        <div className="space-y-3">
          {loading ? <p className="text-gray-400">Loading...</p> :
           reportedPosts.length === 0 ? <p className="text-gray-400 text-center py-8">No reported posts 🎉</p> :
           reportedPosts.map(p => (
            <div key={p.postId} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">@{p.username}</p>
                  <p className="text-gray-600 text-sm mt-1">{p.content}</p>
                  <p className="text-xs text-red-500 mt-1">⚠️ Reason: {p.reportReason}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button onClick={() => clearReport(p.postId)}
                    className="text-xs bg-green-100 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-200">
                    Clear
                  </button>
                  <button onClick={() => deletePost(p.postId)}
                    className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Notification */}
      {tab === 'Global Notification' && (
        <div className="bg-white rounded-xl shadow p-6 max-w-lg">
          <h3 className="font-semibold text-gray-800 mb-2">📢 Send Broadcast Notification</h3>
          <p className="text-sm text-gray-500 mb-4">Sent to ALL registered users instantly.</p>
          <textarea
            className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            rows={4} placeholder="Type your message..."
            value={globalMsg} onChange={e => setGlobalMsg(e.target.value)} />
          <button onClick={sendGlobal}
            className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold text-sm w-full">
            Send to All Users
          </button>
          {sent && <p className="text-green-600 text-sm mt-2 text-center">✅ Broadcast sent successfully!</p>}
        </div>
      )}
    </div>
  );
}
