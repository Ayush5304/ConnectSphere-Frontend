import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const rows = [
  ['Saved', 'Posts you saved'],
  ['Archive', 'Expired stories and hidden posts'],
  ['Your activity', 'Likes, comments, follows, and searches'],
  ['Notifications', 'Activity and broadcast alerts', '/notifications'],
  ['Time management', 'Daily usage tools'],
  ['Privacy Centre', 'Review safety settings'],
  ['Account Status', 'Your account is in good standing'],
  ['About', 'ConnectSphere social platform'],
];

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const currentUserId = user?.userId ?? user?.id;
  const [privateAccount, setPrivateAccount] = useState(Boolean(user?.privateAccount));
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [message, setMessage] = useState('');
  const visible = useMemo(() => rows.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase())), [query]);

  const setLocalPrivacyFallback = (value) => {
    const next = { ...(user || {}), privateAccount: value };
    localStorage.setItem('user', JSON.stringify(next));
    const key = 'connectsphere-profile-overrides';
    let overrides = {};
    try { overrides = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    if (currentUserId) {
      overrides[String(currentUserId)] = { ...(overrides[String(currentUserId)] || {}), privateAccount: value };
      localStorage.setItem(key, JSON.stringify(overrides));
    }
    updateUser?.({ privateAccount: value });
  };

  const togglePrivacy = async () => {
    if (!currentUserId || savingPrivacy) return;
    const nextValue = !privateAccount;
    setPrivateAccount(nextValue);
    setSavingPrivacy(true);
    setMessage('');
    try {
      const { data } = await authApi.updatePrivacy(currentUserId, nextValue);
      updateUser?.(data || { privateAccount: nextValue });
      setLocalPrivacyFallback(nextValue);
      setMessage(nextValue ? 'Your account is now private.' : 'Your account is now public.');
    } catch {
      setLocalPrivacyFallback(nextValue);
      setMessage(nextValue ? 'Your account is now private on this device. Restart auth-service to save it in backend.' : 'Your account is now public on this device. Restart auth-service to save it in backend.');
    } finally {
      setSavingPrivacy(false);
      window.setTimeout(() => setMessage(''), 4500);
    }
  };

  return (
    <main className="max-w-2xl mx-auto bg-white min-h-[calc(100vh-64px)] pb-24">
      <div className="sticky top-16 z-20 bg-white border-b border-neutral-200 px-4 h-16 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-sm font-black text-neutral-700" aria-label="Go back">Back</button>
        <h1 className="text-2xl font-black">Settings and activity</h1>
      </div>
      <div className="p-4"><input value={query} onChange={e => setQuery(e.target.value)} className="w-full h-12 rounded-xl bg-neutral-100 px-4 outline-none" placeholder="Search" /></div>
      <p className="px-4 py-2 text-lg font-black text-neutral-500">Your account</p>
      <Link to="/edit-profile" className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100 hover:bg-neutral-50">
        <div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center">@</div>
        <div><p className="text-lg font-bold">Accounts Centre</p><p className="text-neutral-500">Profile, password, personal details</p></div><span className="ml-auto text-neutral-400">&gt;</span>
      </Link>

      <div className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100">
        <div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center">P</div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">Account privacy</p>
          <p className="text-neutral-500">{privateAccount ? 'Private account: only followers can see your posts and stories.' : 'Public account: anyone can see your profile posts and stories.'}</p>
        </div>
        <button
          type="button"
          onClick={togglePrivacy}
          disabled={savingPrivacy}
          className={(privateAccount ? 'bg-blue-500' : 'bg-neutral-300') + ' relative w-14 h-8 rounded-full transition-colors disabled:opacity-60'}
          aria-label="Toggle private account"
        >
          <span className={(privateAccount ? 'translate-x-6' : 'translate-x-1') + ' absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform'} />
        </button>
      </div>
      {message && <div className="mx-4 mt-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold px-4 py-3">{message}</div>}

      <p className="px-4 pt-5 pb-2 text-lg font-black text-neutral-500">How you use ConnectSphere</p>
      {visible.map(([title, sub, href]) => {
        const content = <><div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center">{title[0]}</div><div><p className="text-lg font-bold">{title}</p><p className="text-neutral-500">{sub}</p></div><span className="ml-auto text-neutral-400">&gt;</span></>;
        return href ? <Link key={title} to={href} className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100 hover:bg-neutral-50">{content}</Link> : <div key={title} className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100">{content}</div>;
      })}
      <div className="mt-4 border-t border-neutral-200">
        <button onClick={() => navigate('/login')} className="w-full text-left px-4 py-4 text-blue-500 text-lg">Add account</button>
        <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-4 py-4 text-rose-600 text-lg">Log out</button>
      </div>
    </main>
  );
}
