import React, { useEffect, useState, useCallback } from 'react';
import { postApi, followApi, authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import StoriesBar from '../stories/StoriesBar';
import CreatePost from './CreatePost';
import PostCard from './PostCard';

function SkeletonCard() {
  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 skeleton rounded w-28" />
          <div className="h-2.5 skeleton rounded w-20" />
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="h-3 skeleton rounded w-full" />
        <div className="h-3 skeleton rounded w-5/6" />
        <div className="h-3 skeleton rounded w-3/4" />
      </div>
      <div className="mt-4 h-2.5 skeleton rounded w-24" />
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [suggestions, setSuggestions]   = useState([]);
  const [followingMap, setFollowingMap] = useState({});

  const isGuest = !user || user.role === 'GUEST';

  // ── BUG-FIX: Proper personalized feed loading ──────────────────────────────
  //
  // Original bug: both guest and logged-in users called the same public
  // getFeed() endpoint. This meant:
  //   1. A logged-in user's own new posts would not appear after refresh
  //      if the public feed didn't include them.
  //   2. Posts from followed users were never fetched.
  //
  // Fix: For logged-in users we:
  //   a) Fetch the list of followed user IDs.
  //   b) Add the current user's own ID so their own posts always appear.
  //   c) Call getFeedForUsers() which returns the personalised feed.
  //   d) Fall back to getFeed() if that fails or returns nothing.
  // ──────────────────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isGuest) {
        // Public / guest feed — no auth needed
        const { data } = await postApi.getFeed();
        setPosts(Array.isArray(data) ? data : []);
      } else {
        // Logged-in user — load personalised feed
        let feedPosts = [];
        try {
          // Step 1: Get the IDs of everyone this user follows
          const { data: followingIds } = await followApi.getFollowing(user.userId);

          // Step 2: Always include the user's own posts in the feed
          const ids = Array.isArray(followingIds) ? followingIds : [];
          if (!ids.includes(Number(user.userId)) && !ids.includes(String(user.userId))) {
            ids.push(Number(user.userId));
          }

          if (ids.length > 0) {
            // Step 3: Fetch posts for those specific users
            const { data } = await postApi.getFeedForUsers(ids);
            feedPosts = Array.isArray(data) ? data : [];
          }
        } catch {
          // Silently fall through to the global feed
        }

        // Step 4: If personalised feed is empty, fall back to the global public feed
        if (feedPosts.length === 0) {
          try {
            const { data } = await postApi.getFeed();
            feedPosts = Array.isArray(data) ? data : [];
          } catch {
            feedPosts = [];
          }
        }

        setPosts(feedPosts);
      }
    } catch {
      setError('Could not load feed. Please try again.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    loadFeed();

    // Load follow suggestions for logged-in users
    if (!isGuest && user) {
      followApi.getSuggestions(user.userId)
        .then(({ data: ids }) => {
          const idList = Array.isArray(ids) ? ids : [];
          if (idList.length > 0) {
            Promise.all(
              idList.slice(0, 5).map(id =>
                authApi.getUserById(id).then(r => r.data).catch(() => null)
              )
            ).then(us => setSuggestions(us.filter(Boolean)));
          }
        }).catch(() => {});
    }
  }, [loadFeed, isGuest, user]);

  // ── Post lifecycle callbacks ───────────────────────────────────────────────

  // New post created — prepend to local state immediately (optimistic update).
  // The post is already persisted in the backend at this point.
  const handleCreated = (post) => setPosts(prev => [post, ...prev]);

  const handleDelete = async (postId) => {
    try { await postApi.delete(postId); } catch {}
    setPosts(prev => prev.filter(p => p.postId !== postId));
  };

  const handleFollow = async (userId) => {
    if (!user) return;
    try {
      await followApi.follow(user.userId, userId);
      setFollowingMap(prev => ({ ...prev, [userId]: true }));
    } catch {}
  };

  return (
    <div className="page-container py-5">
      <div className="flex gap-5 items-start">

        {/* ── Main Feed ── */}
        <div className="flex-1 min-w-0 max-w-[600px] mx-auto lg:mx-0">

          {/* Stories */}
          {!isGuest && <StoriesBar />}

          {/* Guest banner */}
          {isGuest && (
            <div className="card mb-4 p-5 fade-in" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)', borderColor: '#c7d2fe' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl g-primary flex items-center justify-center text-white text-xl flex-shrink-0 shadow-sm">👋</div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Welcome to ConnectSphere</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Sign up</Link> or{' '}
                    <Link to="/login" className="text-indigo-600 font-semibold hover:underline">log in</Link> to post, like, comment &amp; follow people.
                  </p>
                </div>
                <Link to="/register" className="btn-primary text-xs py-2 px-4 flex-shrink-0">Join Free</Link>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="card mb-4 p-4 border-red-200 bg-red-50">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </p>
              <button onClick={loadFeed} className="text-xs text-indigo-600 font-semibold mt-2 hover:underline">
                Retry
              </button>
            </div>
          )}

          {/* Create post */}
          {!isGuest && <CreatePost onCreated={handleCreated} />}

          {/* Posts */}
          {loading ? (
            <>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</>
          ) : posts.length === 0 ? (
            <div className="card p-14 text-center fade-in">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p className="font-bold text-slate-800 text-base mb-1">Your feed is empty</p>
              <p className="text-sm text-slate-400 mb-5">Follow people to see their posts here.</p>
              {isGuest && (
                <Link to="/register" className="btn-primary text-sm py-2 px-6">Get Started</Link>
              )}
            </div>
          ) : (
            posts.map(post => (
              <div key={post.postId} className="fade-in">
                <PostCard post={post} onDelete={handleDelete} />
              </div>
            ))
          )}
        </div>

        {/* ── Right Sidebar ── */}
        {!isGuest && (
          <div className="w-[280px] flex-shrink-0 hidden lg:block">
            <div className="sticky top-20 space-y-4">

              {/* Profile card */}
              <div className="card p-4">
                <Link to={`/profile/${user?.userId}`} className="flex items-center gap-3 group mb-3">
                  <div className="avatar w-11 h-11 text-sm flex-shrink-0">
                    {user?.profilePicture
                      ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                      : user?.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">
                      {user?.fullName || user?.username}
                    </p>
                    <p className="text-xs text-slate-400 truncate">@{user?.username}</p>
                  </div>
                </Link>
                <Link to="/edit-profile"
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profile
                </Link>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="card p-4">
                  <p className="section-label mb-3">People you may know</p>
                  <div className="space-y-3">
                    {suggestions.map(u => (
                      <div key={u.userId} className="flex items-center gap-2.5">
                        <Link to={`/profile/${u.userId}`} className="flex-shrink-0">
                          <div className="avatar w-9 h-9 text-xs">
                            {u.profilePicture
                              ? <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                              : u.username?.[0]?.toUpperCase()}
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${u.userId}`}>
                            <p className="text-xs font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors">
                              {u.fullName || u.username}
                            </p>
                            <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                          </Link>
                        </div>
                        {followingMap[u.userId] ? (
                          <span className="text-xs text-slate-400 font-medium flex-shrink-0">Following</span>
                        ) : (
                          <button
                            onClick={() => handleFollow(u.userId)}
                            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex-shrink-0 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition-colors"
                          >
                            Follow
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 px-1">© 2025 ConnectSphere</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
