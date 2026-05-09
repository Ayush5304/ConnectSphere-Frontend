import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';

const THREADS_KEY = 'connectsphere-message-threads';
const TYPING_KEY = 'connectsphere-message-typing';
const PRESENCE_KEY = 'connectsphere-message-presence';
const MESSAGE_EVENT = 'connectsphere:messages-updated';
const TYPING_EVENT = 'connectsphere:typing-updated';
const PRESENCE_EVENT = 'connectsphere:presence-updated';

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
};

const readThreads = () => readJson(THREADS_KEY, {});
const readTyping = () => readJson(TYPING_KEY, {});
const readPresence = () => readJson(PRESENCE_KEY, {});

const writeJson = (key, value, eventName) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(eventName));
};

const saveThreads = (threads) => writeJson(THREADS_KEY, threads, MESSAGE_EVENT);
const saveTyping = (typing) => writeJson(TYPING_KEY, typing, TYPING_EVENT);
const savePresence = (presence) => writeJson(PRESENCE_KEY, presence, PRESENCE_EVENT);

const threadIdFor = (a, b) => [String(a), String(b)].sort().join(':');
const nowIso = () => new Date().toISOString();

const normalizeMessage = (message) => ({
  status: 'sent',
  deliveredAt: null,
  seenAt: null,
  seenBy: message.senderId ? [Number(message.senderId)] : [],
  deletedFor: [],
  unsent: false,
  ...message,
});

const relativeTime = (value) => {
  if (!value) return 'now';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
};

const dateLine = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
export default function Messages() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const peerId = params.get('user');
  const [users, setUsers] = useState([]);
  const [threads, setThreads] = useState(() => readThreads());
  const [typing, setTyping] = useState(() => readTyping());
  const [presence, setPresence] = useState(() => readPresence());
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [actionMessage, setActionMessage] = useState(null);
  const bottomRef = useRef(null);

  const currentUserId = user?.userId ?? user?.id;
  const activeThreadId = currentUserId && peerId ? threadIdFor(currentUserId, peerId) : '';
  const rawMessages = activeThreadId ? (threads[activeThreadId] || []).map(normalizeMessage) : [];
  const messages = useMemo(
    () => rawMessages.filter(msg => !(msg.deletedFor || []).map(String).includes(String(currentUserId))),
    [rawMessages, currentUserId]
  );

  useEffect(() => {
    let cancelled = false;
    authApi.getAllUsers()
      .then(({ data }) => {
        if (cancelled) return;
        setUsers((Array.isArray(data) ? data : []).filter(item =>
          String(item.userId) !== String(currentUserId) &&
          item.role !== 'ADMIN' && item.role !== 'GUEST' && item.active !== false
        ));
      })
      .catch(() => !cancelled && setUsers([]));
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    const sync = () => { setThreads(readThreads()); setTyping(readTyping()); setPresence(readPresence()); };
    window.addEventListener('storage', sync);
    window.addEventListener(MESSAGE_EVENT, sync);
    window.addEventListener(TYPING_EVENT, sync);
    window.addEventListener(PRESENCE_EVENT, sync);
    const interval = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(MESSAGE_EVENT, sync);
      window.removeEventListener(TYPING_EVENT, sync);
      window.removeEventListener(PRESENCE_EVENT, sync);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const touchPresence = () => {
      const next = { ...readPresence(), [currentUserId]: Date.now() };
      savePresence(next);
      setPresence(next);
    };
    touchPresence();
    const interval = window.setInterval(touchPresence, 15000);
    return () => window.clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    if (!activeThreadId || !currentUserId) return;
    const current = readThreads();
    const currentMessages = current[activeThreadId] || [];
    let changed = false;
    const nextMessages = currentMessages.map(raw => {
      const msg = normalizeMessage(raw);
      const mine = String(msg.senderId) === String(currentUserId);
      const alreadySeen = (msg.seenBy || []).map(String).includes(String(currentUserId));
      if (mine || alreadySeen || msg.unsent) return msg;
      changed = true;
      return { ...msg, status: 'seen', seenAt: nowIso(), seenBy: [...new Set([...(msg.seenBy || []), Number(currentUserId)])] };
    });
    if (changed) {
      const updated = { ...current, [activeThreadId]: nextMessages };
      setThreads(updated);
      saveThreads(updated);
    }
  }, [activeThreadId, currentUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [peerId, messages.length]);

  const peer = users.find(item => String(item.userId) === String(peerId));
  const isOnline = (userId) => Date.now() - Number(presence[userId] || 0) < 45000;
  const getThread = (userId) => (threads[threadIdFor(currentUserId, userId)] || []).map(normalizeMessage);
  const getVisibleThread = (userId) => getThread(userId).filter(msg => !(msg.deletedFor || []).map(String).includes(String(currentUserId)));
  const getUnreadCount = (userId) => getVisibleThread(userId).filter(msg => String(msg.senderId) !== String(currentUserId) && !(msg.seenBy || []).map(String).includes(String(currentUserId))).length;

  const inbox = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(item => !q || (String(item.fullName || '') + ' ' + String(item.username || '')).toLowerCase().includes(q))
      .sort((a, b) => {
        const aLast = getVisibleThread(a.userId).at(-1);
        const bLast = getVisibleThread(b.userId).at(-1);
        return new Date(bLast?.createdAt || 0) - new Date(aLast?.createdAt || 0);
      });
  }, [users, threads, query, currentUserId]);

  const latestOutgoingId = useMemo(() => [...messages].reverse().find(msg => String(msg.senderId) === String(currentUserId))?.id, [messages, currentUserId]);

  const latestStatusText = (message) => {
    if (message.unsent) return '';
    const seenByPeer = (message.seenBy || []).map(String).includes(String(peerId));
    if (seenByPeer || message.status === 'seen') return 'Seen';
    if (message.status === 'delivered') return 'Delivered - ' + relativeTime(message.deliveredAt || message.createdAt);
    return 'Sent - ' + relativeTime(message.createdAt);
  };

  const updateTyping = (value) => {
    setText(value);
    if (!activeThreadId || !currentUserId) return;
    const next = { ...readTyping(), [activeThreadId]: value.trim() ? { userId: currentUserId, until: Date.now() + 1800 } : null };
    saveTyping(next);
    setTyping(next);
  };

  const send = () => {
    const cleanText = text.trim();
    if (!cleanText || !currentUserId || !peerId || !activeThreadId) return;
    const nextMessage = {
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      senderId: Number(currentUserId),
      receiverId: Number(peerId),
      text: cleanText,
      createdAt: nowIso(),
      deliveredAt: null,
      seenAt: null,
      status: 'sent',
      seenBy: [Number(currentUserId)],
      deletedFor: [],
      unsent: false,
    };
    const current = readThreads();
    const updated = { ...current, [activeThreadId]: [...(current[activeThreadId] || []), nextMessage] };
    setThreads(updated);
    saveThreads(updated);
    updateTyping('');

    window.setTimeout(() => {
      const latestThreads = readThreads();
      const deliveredMessages = (latestThreads[activeThreadId] || []).map(raw => {
        const msg = normalizeMessage(raw);
        if (msg.id !== nextMessage.id || msg.status !== 'sent' || msg.unsent) return msg;
        return { ...msg, status: 'delivered', deliveredAt: nowIso() };
      });
      const deliveredThreads = { ...latestThreads, [activeThreadId]: deliveredMessages };
      setThreads(deliveredThreads);
      saveThreads(deliveredThreads);
    }, 350);
  };

  const updateMessage = (messageId, updater) => {
    if (!activeThreadId) return;
    const current = readThreads();
    const nextMessages = (current[activeThreadId] || []).map(raw => {
      const msg = normalizeMessage(raw);
      return msg.id === messageId ? updater(msg) : msg;
    });
    const updated = { ...current, [activeThreadId]: nextMessages };
    setThreads(updated);
    saveThreads(updated);
    setActionMessage(null);
  };

  const deleteForMe = (messageId) => updateMessage(messageId, msg => ({ ...msg, deletedFor: [...new Set([...(msg.deletedFor || []), Number(currentUserId)])] }));
  const unsendMessage = (messageId) => updateMessage(messageId, msg => ({ ...msg, text: 'This message was unsent', unsent: true, status: 'seen', unsentAt: nowIso(), deletedFor: [] }));

  const peerTyping = activeThreadId && typing[activeThreadId] && String(typing[activeThreadId]?.userId) === String(peerId) && Number(typing[activeThreadId]?.until || 0) > Date.now();

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top_left,rgba(214,41,118,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,149,246,0.12),transparent_28%),linear-gradient(180deg,#fafafa,#f4f4f5)] px-0 sm:px-5 py-0 sm:py-6 pb-20">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur sm:border border-neutral-200 sm:rounded-[28px] overflow-hidden min-h-[calc(100vh-96px)] grid grid-cols-1 md:grid-cols-[390px_1fr] shadow-[0_24px_80px_rgba(0,0,0,0.10)]">
        <aside className={(peerId ? 'hidden md:block ' : 'block ') + 'border-r border-neutral-200 bg-white/80'}>
          <div className="p-5 border-b border-neutral-200 sticky top-0 bg-white/95 backdrop-blur z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight truncate">{user?.username || 'Messages'}</h1>
                <p className="text-xs text-neutral-500 font-bold mt-0.5">Direct messages</p>
              </div>
              <div className="w-10 h-10 rounded-full g-primary text-white flex items-center justify-center font-black shadow-lg">+</div>
            </div>
            <div className="mt-4 rounded-2xl bg-neutral-100 px-4 h-12 flex items-center focus-within:ring-2 focus-within:ring-blue-100">
              <span className="text-neutral-400 mr-2">Search</span>
              <input value={query} onChange={e => setQuery(e.target.value)} className="bg-transparent outline-none flex-1 text-sm" placeholder="Search messages" />
            </div>
          </div>

          <div className="max-h-[calc(100vh-206px)] overflow-y-auto p-2">
            {inbox.length === 0 && <div className="p-8 text-center text-sm text-neutral-500"><p className="font-black text-neutral-900">No chats yet</p><p>Search for people and start a conversation.</p></div>}
            {inbox.map(item => {
              const itemThread = getVisibleThread(item.userId);
              const last = itemThread.at(-1);
              const unread = getUnreadCount(item.userId);
              const active = String(peerId) === String(item.userId);
              const preview = last?.unsent ? 'This message was unsent' : (last ? (String(last.senderId) === String(currentUserId) ? 'You: ' : '') + last.text : '@' + item.username);
              return (
                <button key={item.userId} onClick={() => setParams({ user: item.userId })} className={(active ? 'bg-neutral-100 ' : 'hover:bg-neutral-50 ') + 'w-full flex items-center gap-3 p-4 rounded-3xl text-left transition group'}>
                  <div className="relative">
                    <Avatar user={item} size="lg" />
                    {isOnline(item.userId) && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black truncate text-neutral-950">{item.fullName || item.username}</p>
                      <span className="text-xs text-neutral-400 shrink-0">{last ? relativeTime(last.createdAt) : ''}</span>
                    </div>
                    <p className={(unread ? 'font-black text-neutral-950 ' : 'text-neutral-500 ') + 'text-sm truncate'}>{preview}</p>
                  </div>
                  {unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center">{unread}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className={(peerId ? 'flex ' : 'hidden md:flex ') + 'flex-col min-h-[calc(100vh-96px)] bg-[linear-gradient(180deg,#fff,#fbfbfc)]'}>
          {!peer ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <div className="w-20 h-20 rounded-[28px] g-primary mx-auto mb-5 flex items-center justify-center text-white font-black text-3xl shadow-xl">DM</div>
                <h2 className="text-3xl font-black tracking-tight">Your messages</h2>
                <p className="text-neutral-500 mt-2">Choose a conversation or search for someone to start a polished ConnectSphere chat.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="h-20 border-b border-neutral-200 px-4 sm:px-6 flex items-center justify-between bg-white/85 backdrop-blur sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setParams({})} className="md:hidden w-10 h-10 rounded-full hover:bg-neutral-100">Back</button>
                  <div className="relative"><Avatar user={peer} size="lg" />{isOnline(peer.userId) && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />}</div>
                  <Link to={'/profile/' + peer.userId} className="min-w-0">
                    <p className="font-black truncate text-neutral-950">{peer.fullName || peer.username}</p>
                    <p className="text-sm text-neutral-500 truncate">{isOnline(peer.userId) ? 'Active now' : '@' + peer.username}</p>
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-neutral-700">
                  <button className="hidden sm:flex px-4 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 font-black text-sm transition">Audio</button>
                  <button className="hidden sm:flex px-4 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 font-black text-sm transition">Video</button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-3">
                <div className="text-center mb-8">
                  <Avatar user={peer} size="xl" />
                  <p className="mt-3 font-black text-xl">{peer.fullName || peer.username}</p>
                  <p className="text-neutral-500 text-sm">@{peer.username}</p>
                </div>

                {messages.length === 0 && <div className="text-center text-neutral-500 text-sm py-10">Send a message to start the conversation.</div>}
                {messages.map((msg, index) => {
                  const mine = String(msg.senderId) === String(currentUserId);
                  const previous = messages[index - 1];
                  const showDate = !previous || dateLine(previous.createdAt) !== dateLine(msg.createdAt);
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && <div className="text-center text-xs text-neutral-400 font-bold py-4">{dateLine(msg.createdAt)}</div>}
                      <div className={(mine ? 'justify-end ' : 'justify-start ') + 'flex group relative'}>
                        {!mine && <div className="mr-2 self-end"><Avatar user={peer} size="sm" /></div>}
                        <div className={(mine ? 'items-end ' : 'items-start ') + 'max-w-[78%] flex flex-col'}>
                          <div className={(mine ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white rounded-br-md ' : 'bg-white border border-neutral-200 text-neutral-950 rounded-bl-md ') + (msg.unsent ? 'italic text-neutral-400 bg-neutral-100 border-neutral-200 ' : '') + 'rounded-[24px] px-4 py-3 shadow-sm break-words'}>
                            {msg.text}
                          </div>
                          {msg.id === latestOutgoingId && mine && !msg.unsent && <span className="text-[11px] text-neutral-400 mt-1 mr-1 font-semibold">{latestStatusText(msg)}</span>}
                        </div>
                        <button onClick={() => setActionMessage(actionMessage === msg.id ? null : msg.id)} className="opacity-0 group-hover:opacity-100 transition ml-2 self-center w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-500">...</button>
                        {actionMessage === msg.id && (
                          <div className={(mine ? 'right-10 ' : 'left-12 ') + 'absolute top-full mt-2 z-30 w-44 rounded-2xl bg-white border border-neutral-200 shadow-xl p-2'}>
                            {mine && !msg.unsent && <button onClick={() => unsendMessage(msg.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-bold text-sm">Unsend</button>}
                            <button onClick={() => deleteForMe(msg.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-neutral-100 font-bold text-sm">Delete for me</button>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                {peerTyping && <div className="text-sm text-neutral-500 pl-12">typing...</div>}
                <div ref={bottomRef} />
              </div>

              <footer className="p-4 sm:p-5 border-t border-neutral-200 bg-white/90 backdrop-blur">
                <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white shadow-sm px-4 py-2 focus-within:ring-2 focus-within:ring-blue-100">
                  <button type="button" className="w-10 h-10 rounded-full g-primary text-white font-black shrink-0">+</button>
                  <input value={text} onChange={e => updateTyping(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Message..." className="flex-1 outline-none bg-transparent text-sm" />
                  <button onClick={send} disabled={!text.trim()} className="px-5 h-10 rounded-full bg-blue-500 text-white font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 transition">Send</button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
