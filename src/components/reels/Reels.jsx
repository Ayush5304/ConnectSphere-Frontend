import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, postApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';

const LIKES_KEY = 'connectsphere-reel-likes';
const SAVES_KEY = 'connectsphere-reel-saves';

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
};

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const isVideoUrl = (value) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || ''));
const mediaFor = (post) => resolveMediaUrl(post?.mediaUrl || post?.media || post?.imageUrl || post?.videoUrl || '');

function ReelAction({ active, label, count, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1 text-white">
      <span className={(active ? 'bg-white text-pink-600 scale-110 ' : 'bg-white/12 text-white ') + 'w-12 h-12 rounded-full backdrop-blur border border-white/15 flex items-center justify-center text-xl font-black transition group-hover:scale-110'}>{children}</span>
      <span className="text-[11px] font-black drop-shadow">{count || label}</span>
    </button>
  );
}

export default function Reels() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(() => readJson(LIKES_KEY, {}));
  const [saved, setSaved] = useState(() => readJson(SAVES_KEY, {}));
  const videoRefs = useRef({});

  const loadReels = () => {
    setLoading(true);
    setError('');
    postApi.getFeed()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data.filter(post => !post.deleted && isVideoUrl(mediaFor(post))) : [];
        setPosts(list);
        const ids = [...new Set(list.map(post => post.userId).filter(Boolean))];
        return Promise.all(ids.map(id => authApi.getUserById(id).then(({ data: author }) => [id, author]).catch(() => [id, null])));
      })
      .then(entries => {
        const nextAuthors = {};
        (entries || []).forEach(([id, author]) => { if (author) nextAuthors[id] = author; });
        setAuthors(nextAuthors);
      })
      .catch(() => {
        setPosts([]);
        setError('Could not load reels. Check that your backend is running and video posts exist.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReels(); }, []);

  useEffect(() => {
    if (!posts.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.65 });
    Object.values(videoRefs.current).forEach(video => video && observer.observe(video));
    return () => observer.disconnect();
  }, [posts]);

  const toggleLike = (postId) => {
    const next = { ...liked, [postId]: !liked[postId] };
    setLiked(next);
    writeJson(LIKES_KEY, next);
  };

  const toggleSave = (postId) => {
    const next = { ...saved, [postId]: !saved[postId] };
    setSaved(next);
    writeJson(SAVES_KEY, next);
  };

  const shareReel = async (post) => {
    const url = window.location.origin + '/reels?post=' + post.postId;
    try {
      if (navigator.share) await navigator.share({ title: 'ConnectSphere reel', text: post.caption || 'Watch this reel', url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  const reels = useMemo(() => posts.map(post => ({ ...post, author: authors[post.userId] || { userId: post.userId, username: 'creator', fullName: 'Creator' } })), [posts, authors]);

  return (
    <main className="bg-black min-h-[calc(100vh-64px)] text-white overflow-hidden">
      <div className="fixed top-16 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-md mx-auto px-4 pt-4 flex items-center justify-between">
          <div className="pointer-events-auto">
            <h1 className="text-2xl font-black tracking-tight drop-shadow">Reels</h1>
            <p className="text-xs text-white/60 font-bold">Swipe to watch video posts</p>
          </div>
          <button onClick={loadReels} className="pointer-events-auto h-10 px-4 rounded-full bg-white/15 hover:bg-white/25 border border-white/15 backdrop-blur font-black text-sm transition">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-center px-6">
          <div>
            <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white mx-auto animate-spin" />
            <p className="mt-5 font-black text-xl">Loading reels...</p>
          </div>
        </div>
      ) : error ? (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-center px-6">
          <div className="max-w-sm rounded-[28px] bg-white/10 border border-white/15 p-8 backdrop-blur">
            <p className="text-2xl font-black">Reels need a refresh</p>
            <p className="text-white/60 mt-2">{error}</p>
            <button onClick={loadReels} className="mt-6 h-12 px-6 rounded-full bg-white text-black font-black">Try again</button>
          </div>
        </div>
      ) : reels.length === 0 ? (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-center px-6">
          <div className="max-w-sm rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(214,41,118,0.32),transparent_45%),rgba(255,255,255,0.08)] border border-white/15 p-8 backdrop-blur shadow-2xl">
            <div className="w-20 h-20 rounded-[28px] g-primary mx-auto flex items-center justify-center text-3xl font-black">C</div>
            <h2 className="text-3xl font-black mt-6">No reels yet</h2>
            <p className="text-white/65 mt-2">Create a video post and it will appear here as a full-screen reel.</p>
            <Link to="/" className="inline-flex mt-6 h-12 px-6 rounded-full bg-white text-black font-black items-center justify-center">Create from feed</Link>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-64px)] overflow-y-auto snap-y snap-mandatory scroll-smooth">
          {reels.map((post) => {
            const media = mediaFor(post);
            const author = post.author;
            const postId = post.postId || post.id;
            const likeCount = Number(post.likesCount || post.likeCount || post.reactionCount || 0) + (liked[postId] ? 1 : 0);
            return (
              <section key={postId} className="snap-start min-h-[calc(100vh-64px)] flex items-center justify-center px-0 sm:px-6 py-0 sm:py-6 relative">
                <div className="relative w-full sm:max-w-[430px] h-[calc(100vh-64px)] sm:h-[calc(100vh-112px)] sm:rounded-[34px] overflow-hidden bg-neutral-950 shadow-[0_30px_90px_rgba(0,0,0,0.45)] border border-white/10">
                  <video
                    ref={node => { if (node) videoRefs.current[postId] = node; }}
                    src={media}
                    className="absolute inset-0 w-full h-full object-cover"
                    loop
                    muted
                    playsInline
                    controls={false}
                    onClick={event => event.currentTarget.paused ? event.currentTarget.play().catch(() => {}) : event.currentTarget.pause()}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35" />

                  <div className="absolute left-4 right-20 bottom-8 z-10">
                    <Link to={'/profile/' + author.userId} className="flex items-center gap-3 mb-4">
                      <Avatar user={author} size="md" />
                      <div className="min-w-0">
                        <p className="font-black truncate drop-shadow">{author.fullName || author.username}</p>
                        <p className="text-xs text-white/70 truncate">@{author.username}</p>
                      </div>
                      {String(author.userId) !== String(user?.userId) && <span className="ml-2 px-3 py-1 rounded-full border border-white/35 text-xs font-black">Follow</span>}
                    </Link>
                    <p className="text-sm leading-relaxed drop-shadow line-clamp-3">{post.caption || 'A ConnectSphere reel'}</p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/80 backdrop-blur"><span>Audio</span><span>Original sound</span></div>
                  </div>

                  <div className="absolute right-4 bottom-8 z-20 flex flex-col items-center gap-5">
                    <ReelAction active={liked[postId]} count={likeCount || 'Like'} onClick={() => toggleLike(postId)}>L</ReelAction>
                    <ReelAction label="Comment" onClick={() => window.alert('Open this post from the feed to comment.')}>C</ReelAction>
                    <ReelAction label="Share" onClick={() => shareReel(post)}>S</ReelAction>
                    <ReelAction active={saved[postId]} label="Save" onClick={() => toggleSave(postId)}>B</ReelAction>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
