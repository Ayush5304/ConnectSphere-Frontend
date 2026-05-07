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
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
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

const relativeTime = (value) => {
  if (!value) return 'now';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
};

const clockTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeMessage = (message) => ({
  status: 'sent',
  deliveredAt: null,
  seenAt: null,
  seenBy: message.senderId ? [Number(message.senderId)] : [],
  ...message,
});

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
  const bottomRef = useRef(null);

  const currentUserId = user?.userId;
  const activeThreadId = currentUserId && peerId ? threadIdFor(currentUserId, peerId) : '';
  const messages = useMemo(
    () => (activeThreadId ? (threads[activeThreadId] || []).map(normalizeMessage) : []),
    [activeThreadId, threads]
  );

  useEffect(() => {
    let cancelled = false;
    authApi.getAllUsers()
      .then(({ data }) => {
        if (cancelled) return;
        setUsers((Array.isArray(data) ? data : []).filter(item =>
          String(item.userId) !== String(currentUserId) &&
          item.role !== 'ADMIN' &&
          item.role !== 'GUEST' &&
          item.active !== false
        ));
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    const sync = () => {
      setThreads(readThreads());
      setTyping(readTyping());
      setPresence(readPresence());
    };
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
      if (mine || alreadySeen) return msg;
      changed = true;
      return {
        ...msg,
        status: 'seen',
        seenAt: nowIso(),
        seenBy: [...new Set([...(msg.seenBy || []), Number(currentUserId)])],
      };
    });
    if (changed) {
      const updated = { ...current, [activeThreadId]: nextMessages };
      setThreads(updated);
      saveThreads(updated);
    }
  }, [activeThreadId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [peerId, messages.length]);

  const peer = users.find(item => String(item.userId) === String(peerId));

  const getThread = (userId) => threads[threadIdFor(currentUserId, userId)] || [];

  const getUnreadCount = (userId) => getThread(userId).filter(raw => {
    const msg = normalizeMessage(raw);
    return String(msg.senderId) !== String(currentUserId) &&
      !(msg.seenBy || []).map(String).includes(String(currentUserId));
  }).length;

  const isOnline = (userId) => Date.now() - Number(presence[userId] || 0) < 45000;

  const inbox = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(item => !q || (String(item.fullName || '') + ' ' + String(item.username || '')).toLowerCase().includes(q))
      .sort((a, b) => {
        const aLast = (threads[threadIdFor(currentUserId, a.userId)] || []).at(-1);
        const bLast = (threads[threadIdFor(currentUserId, b.userId)] || []).at(-1);
        return new Date(bLast?.createdAt || 0) - new Date(aLast?.createdAt || 0);
      });
  }, [users, threads, query, currentUserId]);

  const latestOutgoingId = useMemo(() => {
    return [...messages].reverse().find(msg => String(msg.senderId) === String(currentUserId))?.id;
  }, [messages, currentUserId]);

  const latestStatusText = (message) => {
    const seenByPeer = (message.seenBy || []).map(String).includes(String(peerId));
    if (seenByPeer || message.status === 'seen') return 'Seen';
    if (message.status === 'delivered') return 'Delivered ? ' + relativeTime(message.deliveredAt || message.createdAt);
    return 'Sent ? ' + relativeTime(message.createdAt);
  };

  const updateTyping = (value) => {
    setText(value);
    if (!activeThreadId || !currentUserId) return;
    const next = {
      ...readTyping(),
      [activeThreadId]: value.trim() ? { userId: currentUserId, until: Date.now() + 1800 } : null,
    };
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
    };
    const current = readThreads();
    const updated = {
      ...current,
      [activeThreadId]: [...(current[activeThreadId] || []), nextMessage],
    };
    setThreads(updated);
    saveThreads(updated);
    updateTyping('');

    window.setTimeout(() => {
      const latestThreads = readThreads();
      const latestMessages = latestThreads[activeThreadId] || [];
      const deliveredMessages = latestMessages.map(raw => {
        const msg = normalizeMessage(raw);
        if (msg.id !== nextMessage.id || msg.status !== 'sent') return msg;
        return { ...msg, status: 'delivered', deliveredAt: nowIso() };
      });
      const deliveredThreads = { ...latestThreads, [activeThreadId]: deliveredMessages };
      setThreads(deliveredThreads);
      saveThreads(deliveredThreads);
    }, 350);
  };

  const peerTyping = activeThreadId && typing[activeThreadId] &&
    String(typing[activeThreadId]?.userId) === String(peerId) &&
    Number(typing[activeThreadId]?.until || 0) > Date.now();

  return (
    <main className="max-w-5xl mx-auto px-0 sm:px-4 py-0 sm:py-6 pb-20">
      <div className="bg-white sm:border border-neutral-200 sm:rounded-2xl overflow-hidden min-h-[calc(100vh-96px)] grid grid-cols-1 md:grid-cols-[360px_1fr] shadow-sm">
        <aside className={(peerId ? 'hidden md:block ' : 'block ') + 'border-r border-neutral-200'}>
          <div className="p-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black truncate">{user?.username || 'Messages'}</h1>
              <span className="text-xs font-bold text-neutral-500">DMs</span>
            </div>
            <div className="mt-4 rounded-xl bg-neutral-100 px-3 h-11 flex items-center">
              <span className="text-neutral-400 mr-2">Search</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="bg-transparent outline-none flex-1 text-sm"
                placeholder="Search messages"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-190px)] overflow-y-auto">
            {inbox.length === 0 && (
              <div className="p-8 text-center text-sm text-neutral-500">
                <p className="font-black text-neutral-900">No chats yet</p>
                <p>Search for people and start a conversation.</p>
              </div>
            )}
            {inbox.map(item => {
              const itemThread = getThread(item.userId).map(normalizeMessage);
              const last = itemThread.at(-1);
              const unread = getUnreadCount(item.userId);
              const active = String(peerId) === String(item.userId);
              return (
                <button
                  key={item.userId}
                  onClick={() => setParams({ user: item.userId })}
                  className={'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 ' + (active ? 'bg-neutral-50' : '')}
                >
                  <div className="relative shrink-0">
                    <Avatar src={item.profilePicture || item.profileImage || item.avatarUrl} name={item.fullName || item.username} className="w-14 h-14 text-sm" />
                    {isOnline(item.userId) && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={(unread ? 'font-black ' : 'font-bold ') + 'text-sm truncate'}>{item.fullName || item.username}</p>
                      {last && <span className="ml-auto text-[11px] text-neutral-400 shrink-0">{relativeTime(last.createdAt)}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={(unread ? 'text-neutral-900 font-bold ' : 'text-neutral-500 ') + 'text-xs truncate'}>
                        {last ? (String(last.senderId) === String(currentUserId) ? 'You: ' : '') + last.text : '@' + item.username}
                      </p>
                      {unread > 0 && <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center">{unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={(peerId ? 'flex ' : 'hidden md:flex ') + 'flex-col min-h-[calc(100vh-96px)]'}>
          {peer ? (
            <>
              <div className="h-16 border-b border-neutral-200 px-4 flex items-center gap-3 sticky top-0 bg-white z-10">
                <button className="md:hidden text-2xl leading-none" onClick={() => setParams({})} aria-label="Back">?</button>
                <div className="relative">
                  <Avatar src={peer.profilePicture || peer.profileImage || peer.avatarUrl} name={peer.fullName || peer.username} className="w-10 h-10 text-xs" />
                  {isOnline(peer.userId) && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
                </div>
                <Link to={'/profile/' + peer.userId} className="min-w-0 flex-1">
                  <p className="font-black text-sm truncate">{peer.fullName || peer.username}</p>
                  <p className="text-xs text-neutral-500 truncate">{isOnline(peer.userId) ? 'Active now' : '@' + peer.username}</p>
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Avatar src={peer.profilePicture || peer.profileImage || peer.avatarUrl} name={peer.fullName || peer.username} className="w-24 h-24 text-2xl mb-4" />
                    <p className="font-black text-xl">{peer.fullName || peer.username}</p>
                    <p className="text-sm text-neutral-500">@{peer.username}</p>
                    <p className="text-sm text-neutral-500 mt-2">Send a message to start the conversation.</p>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const mine = String(msg.senderId) === String(currentUserId);
                  const previous = messages[index - 1];
                  const showTime = !previous || (new Date(msg.createdAt) - new Date(previous.createdAt)) > 10 * 60 * 1000;
                  const showLatestOutgoingStatus = mine && msg.id === latestOutgoingId;
                  return (
                    <div key={msg.id}>
                      {showTime && <p className="text-center text-[11px] text-neutral-400 my-3">{clockTime(msg.createdAt)}</p>}
                      <div className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                        <div className={(mine ? 'bg-blue-500 text-white rounded-br-md ' : 'bg-white border border-neutral-200 rounded-bl-md ') + 'max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm'}>
                          {msg.text}
                        </div>
                      </div>
                      {showLatestOutgoingStatus && (
                        <p className="text-[11px] text-neutral-500 text-right mt-1 pr-1">{latestStatusText(msg)}</p>
                      )}
                    </div>
                  );
                })}

                {peerTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md px-4 py-2 bg-white border border-neutral-200 text-xs text-neutral-500 shadow-sm">typing...</div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-neutral-200 bg-white">
                <div className="rounded-full border border-neutral-300 px-4 py-2 flex items-center gap-2 focus-within:border-neutral-500">
                  <input
                    value={text}
                    onChange={e => updateTyping(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    className="flex-1 outline-none text-sm bg-transparent"
                    placeholder="Message..."
                  />
                  <button onClick={send} className="text-blue-500 font-black text-sm disabled:text-neutral-300" disabled={!text.trim()}>Send</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 rounded-full border-2 border-neutral-900 flex items-center justify-center text-3xl mb-4">?</div>
              <p className="text-xl font-black">Your messages</p>
              <p className="text-sm text-neutral-500">Send private messages to people on ConnectSphere.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
