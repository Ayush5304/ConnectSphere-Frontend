import React, { useEffect, useState, useCallback } from 'react';
import { postApi, followApi, authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import StoriesBar from '../stories/StoriesBar';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import Avatar from '../ui/Avatar';

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
  const [requestedMap, setRequestedMap] = useState({});
  const [followingCount, setFollowingCount] = useState(0);
  const [showDiscover, setShowDiscover] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const currentUserId = user?.userId ?? user?.id;
  const isGuest = !user || user.role === 'GUEST';

  const normalizeFeedPosts = (items = []) => {
    const map = new Map();
    items
      .filter(Boolean)
      .filter(post => !post.deleted && post.visibility !== 'PRIVATE')
      .forEach(post => map.set(post.postId, post));
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  };

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isGuest) {
        const { data } = await postApi.getFeed().catch(() => ({ data: [] }));
        setPosts(normalizeFeedPosts(Array.isArray(data) ? data : []).slice(0, 3));
      } else if (currentUserId) {
        const { data: followingIds } = await followApi.getFollowing(currentUserId).catch(() => ({ data: [] }));
        const followed = Array.isArray(followingIds) ? followingIds.map(Number).filter(Boolean) : [];
        setFollowingCount(followed.length);

        const feedUserIds = Array.from(new Set([Number(currentUserId), ...followed]));
        const { data } = await postApi.getFeedForUsers(feedUserIds).catch(() => ({ data: [] }));
        const allowedIds = new Set(feedUserIds.map(String));
        const personalPosts = (Array.isArray(data) ? data : []).filter(post => allowedIds.has(String(post.userId)));
        setPosts(normalizeFeedPosts(personalPosts));
      }
    } catch {
      setError('Could not load feed. Please try again.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isGuest]);

  const loadSuggestions = useCallback(async () => {
    if (!user || !currentUserId || isGuest) return;
    setSuggestionsLoading(true);
    try {
      const { data: followingIds } = await followApi.getFollowing(currentUserId).catch(() => ({ data: [] }));
      const followed = new Set((Array.isArray(followingIds) ? followingIds : []).map(id => String(id)));

      const { data: suggestedIds } = await followApi.getSuggestions(currentUserId).catch(() => ({ data: [] }));
      const idList = Array.isArray(suggestedIds) ? suggestedIds.filter(id => String(id) !== String(currentUserId)) : [];
      const suggestedUsers = idList.length > 0
        ? await Promise.all(idList.map(id => authApi.getUserById(id).then(r => r.data).catch(() => null)))
        : [];

      const { data: allUsersData } = await authApi.getAllUsers().catch(() => ({ data: [] }));
      const allUsers = Array.isArray(allUsersData) ? allUsersData : [];

      const merged = new Map();
      [...suggestedUsers, ...allUsers].filter(Boolean).forEach(item => merged.set(String(item.userId), item));

      const base = Array.from(merged.values())
        .filter(item => String(item.userId) !== String(currentUserId))
        .filter(item => item.role !== 'ADMIN' && item.role !== 'GUEST')
        .filter(item => item.active !== false);

      const statusPairs = await Promise.all(base.map(async item => {
        if (followed.has(String(item.userId))) return [item.userId, true];
        const { data } = await followApi.getRelationshipStatus(currentUserId, item.userId).catch(() => ({ data: { following: false, requested: false } }));
        if (data?.requested || data?.status === 'REQUESTED') setRequestedMap(prev => ({ ...prev, [item.userId]: true }));
        return [item.userId, Boolean(data?.following)];
      }));
      const statusMap = Object.fromEntries(statusPairs);
      setFollowingMap(prev => ({ ...prev, ...statusMap }));

      const cleaned = base
        .filter(item => !statusMap[item.userId])
        .slice(0, 12);

      setSuggestions(cleaned);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [currentUserId, isGuest]);

  useEffect(() => {
    loadFeed();

    if (!isGuest && user) {
      loadSuggestions();
    }
  }, [loadFeed, loadSuggestions, isGuest, user]);

  const handleCreated = (post) => {
    if (!post) return loadFeed();
    setPosts(prev => [post, ...prev.filter(item => item.postId !== post.postId)]);
  };

  const handleDelete = async (postId) => {
    try { await postApi.delete(postId); } catch {}
    setPosts(prev => prev.filter(p => p.postId !== postId));
  };

  const markFollowed = async (targetUserId) => {
    setFollowingMap(prev => ({ ...prev, [targetUserId]: true }));
    setRequestedMap(prev => ({ ...prev, [targetUserId]: false }));
    setSuggestions(prev => prev.filter(item => String(item.userId) !== String(targetUserId)));
    const { data } = await followApi.getFollowing(currentUserId).catch(() => ({ data: [] }));
    setFollowingCount(Array.isArray(data) ? new Set(data.map(id => String(id))).size : 0);
    loadFeed();
  };

  const markRequested = (targetUserId) => {
    setRequestedMap(prev => ({ ...prev, [targetUserId]: true }));
    setFollowingMap(prev => ({ ...prev, [targetUserId]: false }));
  };

  const handleFollow = async (targetUserId) => {
    if (!user || !currentUserId) return;
    try {
      const { data } = await followApi.follow(currentUserId, targetUserId);
      if (data?.requested || data?.status === 'REQUESTED') {
        markRequested(targetUserId);
      } else {
        await markFollowed(targetUserId);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || '';
      const { data } = await followApi.getRelationshipStatus(currentUserId, targetUserId).catch(() => ({ data: { following: false, requested: false } }));
      if (data?.requested || data?.status === 'REQUESTED') {
        markRequested(targetUserId);
      } else if (status === 409 || /already following/i.test(message) || data?.following) {
        await markFollowed(targetUserId);
      } else {
        setError(message || 'Could not follow this user.');
      }
    }
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
                    <Avatar src={user?.profilePicture} name={user?.fullName || user?.username} className="w-16 h-16 border-2 border-white text-xl" />
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
              <p className="font-black text-xl mb-1">Your feed is waiting</p>
              <p className="text-sm text-neutral-500 mb-5">{isGuest ? 'Create an account to build your circle.' : followingCount === 0 ? 'Follow people to see their posts here, or share your first moment.' : 'People you follow have not posted yet.'}</p>
              {isGuest ? <Link to="/register" className="btn-primary">Get started</Link> : <button type="button" onClick={() => { setShowDiscover(true); loadSuggestions(); }} className="btn-primary">Find people to follow</button>}
            </div>
          ) : (
            <>
              {posts.map(post => (
                <div key={post.postId} className="feed-post-shell">
                  <PostCard post={post} onDelete={handleDelete} />
                </div>
              ))}
              {isGuest && (
                <div className="card p-8 sm:p-10 text-center mb-4 fade-in bg-[radial-gradient(circle_at_12%_10%,rgba(254,218,117,0.24),transparent_28%),radial-gradient(circle_at_88%_0%,rgba(214,41,118,0.18),transparent_32%),#fff]">
                  <div className="w-14 h-14 rounded-2xl g-primary flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">C</div>
                  <p className="text-2xl font-black tracking-tight mb-2">You are viewing a guest preview</p>
                  <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">Log in or create an account to unlock the full feed, stories, reactions, comments, follows, messages, and personalized suggestions.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/login" className="btn-primary">Log in</Link>
                    <Link to="/register" className="btn-outline">Create account</Link>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {showDiscover && (
          <div className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowDiscover(false)}>
            <div className="bg-white w-full sm:max-w-md max-h-[82vh] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">People you may know</h3>
                  <p className="text-xs text-neutral-500">Follow people to build your ConnectSphere feed.</p>
                </div>
                <button type="button" onClick={() => setShowDiscover(false)} className="w-9 h-9 rounded-full bg-neutral-100 text-xl leading-none">x</button>
              </div>
              <div className="p-3 max-h-[65vh] overflow-y-auto">
                {suggestionsLoading ? (
                  <p className="text-center text-sm text-neutral-500 py-8">Finding people...</p>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-10 px-5">
                    <p className="font-black mb-1">No suggestions yet</p>
                    <p className="text-sm text-neutral-500">Try searching for users from the search bar.</p>
                  </div>
                ) : suggestions.map(item => (
                  <div key={item.userId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50">
                    <Link to={`/profile/${item.userId}`} onClick={() => setShowDiscover(false)}>
                      <Avatar src={item.profilePicture} name={item.fullName || item.username} className="w-12 h-12 text-sm" />
                    </Link>
                    <Link to={`/profile/${item.userId}`} onClick={() => setShowDiscover(false)} className="min-w-0 flex-1">
                      <p className="text-sm font-black truncate">{item.fullName || item.username}</p>
                      <p className="text-xs text-neutral-500 truncate">@{item.username}</p>
                    </Link>
                    {followingMap[item.userId] ? (
                      <span className="text-xs font-bold text-neutral-400">Following</span>
                    ) : requestedMap[item.userId] ? (
                      <span className="text-xs font-bold text-neutral-400">Requested</span>
                    ) : (
                      <button type="button" onClick={() => handleFollow(item.userId)} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-xs font-black hover:bg-blue-600">
                        Follow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isGuest && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-5">
              <div className="px-1">
                <Link to={`/profile/${currentUserId}`} className="flex items-center gap-3 group">
                  <div className="story-ring">
                    <Avatar src={user?.profilePicture} name={user?.fullName || user?.username} className="w-14 h-14 text-base border-2 border-white" />
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
                        <Link to={`/profile/${item.userId}`}>
                          <Avatar src={item.profilePicture} name={item.fullName || item.username} className="w-10 h-10 text-xs" />
                        </Link>
                        <Link to={`/profile/${item.userId}`} className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{item.fullName || item.username}</p>
                          <p className="text-xs text-neutral-500 truncate">@{item.username}</p>
                        </Link>
                        {followingMap[item.userId] ? (
                          <span className="text-xs font-bold text-neutral-400">Following</span>
                        ) : requestedMap[item.userId] ? (
                          <span className="text-xs font-bold text-neutral-400">Requested</span>
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
