import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const typeLabel = (type = '') => {
  const value = String(type).toUpperCase();
  if (value.includes('LIKE')) return 'Like';
  if (value.includes('COMMENT')) return 'Comment';
  if (value.includes('FOLLOW')) return 'Follow';
  if (value.includes('MESSAGE')) return 'Message';
  if (value.includes('GLOBAL')) return 'Broadcast';
  return 'Activity';
};

const timeAgo = (date) => {
  const diff = Math.max(0, Date.now() - new Date(date || Date.now()).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  return Math.floor(hours / 24) + 'd';
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await notificationApi.getForUser(user.userId);
      const next = Array.isArray(data) ? data : [];
      setItems(next);
      notificationApi.markAllRead(user.userId).catch(() => {});
    } catch (err) {
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.userId]);

  return (
    <main className="max-w-2xl mx-auto bg-white min-h-[calc(100vh-64px)] pb-20">
      <div className="sticky top-16 z-20 bg-white border-b border-neutral-200 px-4 h-16 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-2xl">?</button>
        <h1 className="text-2xl font-black">Notifications</h1>
        <button onClick={load} className="ml-auto text-sm font-black text-blue-500">Refresh</button>
      </div>

      <section className="px-4 py-5 border-b border-neutral-100 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full border border-neutral-200 flex items-center justify-center text-2xl">+</div>
        <div>
          <p className="font-black text-lg">Follow requests</p>
          <p className="text-neutral-500">Approve or ignore requests</p>
        </div>
      </section>

      <h2 className="px-4 pt-5 pb-2 text-xl font-black">Highlights</h2>
      {loading && <p className="px-4 py-8 text-center text-neutral-500">Loading notifications...</p>}
      {error && <div className="m-4 p-4 rounded-xl bg-rose-50 text-rose-600 font-bold text-sm">{error}<button onClick={load} className="block text-blue-500 mt-2">Retry</button></div>}
      {!loading && !error && items.length === 0 && (
        <div className="px-4 py-12 text-center text-neutral-500">
          <p className="font-black text-neutral-900 mb-1">No notifications yet</p>
          <p>Likes, comments, follows, broadcasts, and messages will appear here.</p>
        </div>
      )}
      <div>
        {items.map(item => {
          const unread = !item.read && !item.isRead;
          const deepLink = item.deepLink && !String(item.deepLink).endsWith('/') ? item.deepLink : '';
          return (
            <div key={item.notificationId || item.id || item.createdAt} className={(unread ? 'bg-blue-50/60 ' : '') + 'px-4 py-4 flex items-start gap-3 border-b border-neutral-100'}>
              <div className="avatar w-12 h-12 text-sm">{typeLabel(item.type)[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug"><span className="font-black">{typeLabel(item.type)}</span> {item.message}</p>
                <p className="text-sm text-neutral-500 mt-1">{timeAgo(item.createdAt)}</p>
                {deepLink && <a href={deepLink} className="inline-block mt-1 text-sm font-black text-blue-500">Open</a>}
              </div>
              {String(item.type || '').toUpperCase().includes('FOLLOW') && <Link to="/messages" className="px-4 py-2 rounded-lg bg-neutral-100 font-black text-sm">Message</Link>}
              {unread && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />}
            </div>
          );
        })}
      </div>
    </main>
  );
}
