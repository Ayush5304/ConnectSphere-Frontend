import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const rows = [
  ['Saved', 'Posts you saved'],
  ['Archive', 'Expired stories and hidden posts'],
  ['Your activity', 'Likes, comments, follows, and searches'],
  ['Notifications', 'Activity and broadcast alerts', '/notifications'],
  ['Time management', 'Daily usage tools'],
  ['Account privacy', 'Public profile'],
  ['Privacy Centre', 'Review safety settings'],
  ['Account Status', 'Your account is in good standing'],
  ['About', 'ConnectSphere social platform'],
];

export default function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const visible = useMemo(() => rows.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase())), [query]);
  return (
    <main className="max-w-2xl mx-auto bg-white min-h-[calc(100vh-64px)] pb-24">
      <div className="sticky top-16 z-20 bg-white border-b border-neutral-200 px-4 h-16 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-2xl">?</button>
        <h1 className="text-2xl font-black">Settings and activity</h1>
      </div>
      <div className="p-4"><input value={query} onChange={e => setQuery(e.target.value)} className="w-full h-12 rounded-xl bg-neutral-100 px-4 outline-none" placeholder="Search" /></div>
      <p className="px-4 py-2 text-lg font-black text-neutral-500">Your account</p>
      <Link to="/edit-profile" className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100 hover:bg-neutral-50">
        <div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center">@</div>
        <div><p className="text-lg font-bold">Accounts Centre</p><p className="text-neutral-500">Profile, password, personal details</p></div><span className="ml-auto text-neutral-400">?</span>
      </Link>
      <p className="px-4 pt-5 pb-2 text-lg font-black text-neutral-500">How you use ConnectSphere</p>
      {visible.map(([title, sub, href]) => {
        const content = <><div className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center">{title[0]}</div><div><p className="text-lg font-bold">{title}</p><p className="text-neutral-500">{sub}</p></div><span className="ml-auto text-neutral-400">?</span></>;
        return href ? <Link key={title} to={href} className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100 hover:bg-neutral-50">{content}</Link> : <div key={title} className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100">{content}</div>;
      })}
      <div className="mt-4 border-t border-neutral-200">
        <button onClick={() => navigate('/login')} className="w-full text-left px-4 py-4 text-blue-500 text-lg">Add account</button>
        <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-4 py-4 text-rose-600 text-lg">Log out</button>
      </div>
    </main>
  );
}
