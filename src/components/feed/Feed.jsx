import React, { useEffect, useState, useCallback } from 'react';
import { postApi, followApi, authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import StoriesBar from '../stories/StoriesBar';
import CreatePost from './CreatePost';
import PostCard from './PostCard';

function SkeletonCard() {
  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 skeleton rounded w-28" />
          <div className="h-2.5 skeleton rounded w-20" />
        </div>
      </div>
      <div className="h-[320px] skeleton rounded-lg mb-4" />
      <div className="space-y-2">
        <div className="h-3 skeleton rounded w-full" />
        <div className="h-3 skeleton rounded w-3/4" />
      </div>
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [followingMap, setFollowingMap] = useState({});

  const isGuest = !user || user.role === 'GUEST';

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isGuest) {
        const { data } = await postApi.getFeed();
        setPosts(Array.isArray(data) ? data : []);
      } else {
        let feedPosts = [];
        try {
          const { data: followingIds } = await followApi.getFollowing(user.userId);
          const ids = Array.isArray(followingIds) ? followingIds : [];
          if (!ids.includes(Number(user.userId)) && !ids.includes(String(user.userId))) ids.push(Number(user.userId));

          if (ids.length > 0) {
            const { data } = await postApi.getFeedForUsers(ids);
            feedPosts = Array.isArray(data) ? data : [];
          }
        } catch {}

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

    if (!isGuest && user) {
      followApi.getSuggestions(user.userId)
        .then(({ data: ids }) => {
          const idList = Array.isArray(ids) ? ids : [];
          if (idList.length > 0) {
            Promise.all(
              idList.slice(0, 5).map(id =>
                authApi.getUserById(id).then(r => r.data).catch(() => null)
              )
            ).then(items => setSuggestions(items.filter(Boolean)));
          }
        })
        .catch(() => {});
    }
  }, [loadFeed, isGuest, user]);

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
    <main className="page-container feed-cinema py-6 pb-20 md:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,630px)_300px] gap-8 items-start">
        <section className="min-w-0">
          {!isGuest && (
            <div className="feed-spotlight">
              <div className="feed-spotlight-content">
                <div className="flex items-center gap-4">
                  <div className="story-ring flex-shrink-0">
                    <div className="avatar w-16 h-16 border-2 border-white text-xl">
                      {user?.profilePicture
                        ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        : user?.username?.[0]?.toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">Now streaming</p>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                      Welcome back, {user?.fullName?.split(' ')[0] || user?.username}
                    </h1>
                    <p className="text-sm text-white/65 mt-1">
                      Stories, posts, reactions, and conversations are ready for your next scroll.
                    </p>
                  </div>
                  <button type="button" onClick={loadFeed} className="hidden sm:inline-flex btn-primary cinematic-button px-5">
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isGuest && <StoriesBar />}

          {isGuest && (
            <div className="card mb-4 overflow-hidden fade-in">
              <div className="p-5 sm:p-6 bg-[radial-gradient(circle_at_10%_20%,rgba(254,218,117,0.45),transparent_24%),radial-gradient(circle_at_90%_10%,rgba(193,53,132,0.28),transparent_26%),linear-gradient(135deg,#ffffff_0%,#fafafa_100%)]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl g-primary flex items-center justify-center text-white text-xl font-black flex-shrink-0">C</div>
                  <div className="flex-1">
                    <p className="font-black text-xl tracking-tight">See what people are sharing</p>
                    <p className="text-sm text-neutral-500 mt-1">Create an account to post, like, comment, follow creators, and build your circle.</p>
                  </div>
                  <Link to="/register" className="btn-primary w-full sm:w-auto">Join now</Link>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="card mb-4 p-4 border-rose-200 bg-rose-50">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <button type="button" onClick={loadFeed} className="text-xs text-blue-500 font-bold mt-2 hover:underline">
                Retry
              </button>
            </div>
          )}

          {!isGuest && <CreatePost onCreated={handleCreated} />}

          {loading ? (
            <>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</>
          ) : posts.length === 0 ? (
            <div className="card p-10 sm:p-14 text-center fade-in">
              <div className="w-16 h-16 rounded-2xl border border-neutral-200 flex items-center justify-center mx-auto mb-4">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="font-black text-xl mb-1">No posts yet</p>
              <p className="text-sm text-neutral-500 mb-5">Follow people or share your first moment.</p>
              {isGuest ? <Link to="/register" className="btn-primary">Get started</Link> : null}
            </div>
          ) : (
            posts.map(post => (
              <div key={post.postId} className="feed-post-shell">
                <PostCard post={post} onDelete={handleDelete} />
              </div>
            ))
          )}
        </section>

        {!isGuest && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-5">
              <div className="px-1">
                <Link to={`/profile/${user?.userId}`} className="flex items-center gap-3 group">
                  <div className="story-ring">
                    <div className="avatar w-14 h-14 text-base border-2 border-white">
                      {user?.profilePicture
                        ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        : user?.username?.[0]?.toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm truncate group-hover:text-blue-500">{user?.username}</p>
                    <p className="text-sm text-neutral-500 truncate">{user?.fullName || 'ConnectSphere member'}</p>
                  </div>
                  <Link to="/edit-profile" className="text-xs font-bold text-blue-500 hover:text-blue-600">Edit</Link>
                </Link>
              </div>

              {suggestions.length > 0 && (
                <div className="px-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="section-label">Suggested for you</p>
                    <span className="text-xs font-bold text-neutral-900">See all</span>
                  </div>
                  <div className="space-y-3">
                    {suggestions.map(item => (
                      <div key={item.userId} className="flex items-center gap-3">
                        <Link to={`/profile/${item.userId}`} className="avatar w-10 h-10 text-xs">
                          {item.profilePicture
                            ? <img src={item.profilePicture} alt="" className="w-full h-full object-cover" />
                            : item.username?.[0]?.toUpperCase()}
                        </Link>
                        <Link to={`/profile/${item.userId}`} className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{item.fullName || item.username}</p>
                          <p className="text-xs text-neutral-500 truncate">@{item.username}</p>
                        </Link>
                        {followingMap[item.userId] ? (
                          <span className="text-xs font-bold text-neutral-400">Following</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleFollow(item.userId)}
                            className="text-xs font-bold text-blue-500 hover:text-blue-600"
                          >
                            Follow
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-neutral-400 px-1">
                ConnectSphere is a mini social platform for posts, stories, likes, comments, follows, reports, and admin monitoring.
              </p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
