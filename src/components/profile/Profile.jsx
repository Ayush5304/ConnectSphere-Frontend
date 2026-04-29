import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { postApi, followApi, authApi, likeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../feed/PostCard';
import PaymentModal from '../payment/PaymentModal';

const EMOJI = { LIKE:'👍', LOVE:'❤️', HAHA:'😂', WOW:'😮', SAD:'😢', ANGRY:'😡' };

function Avatar({ src, name, size = 'w-10 h-10', textSize = 'text-sm' }) {
  return (
    <div className={`avatar ${size} ${textSize} flex-shrink-0`}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : (name?.[0] || '?').toUpperCase()}
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user }   = useAuth();

  const [profileUser, setProfileUser]   = useState(null);
  const [posts, setPosts]               = useState([]);
  const [counts, setCounts]             = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading]           = useState(true);

  /* Followers / Following modal */
  const [showModal, setShowModal]       = useState(null); // 'followers' | 'following'
  const [modalUsers, setModalUsers]     = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [mutualIds, setMutualIds]       = useState([]);

  /* Who reacted modal */
  const [reactorsModal, setReactorsModal]   = useState(false);
  const [reactors, setReactors]             = useState([]);
  const [loadingReactors, setLoadingReactors] = useState(false);
  const [selectedPost, setSelectedPost]     = useState(null);

  /* Report */
  const [showReport, setShowReport]     = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported]         = useState(false);

  /* Payment */
  const [showPayment, setShowPayment]   = useState(false);
  const [paymentMsg, setPaymentMsg]     = useState('');

  const isOwnProfile = user && String(user.userId) === String(userId);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      postApi.getByUser(userId),
      followApi.getCounts(userId),
      authApi.getUserById(userId),
    ]).then(([postsRes, countsRes, userRes]) => {
      setPosts(postsRes.data);
      setCounts(countsRes.data);
      setProfileUser(userRes.data);
    }).catch(() => {}).finally(() => setLoading(false));

    if (user && !isOwnProfile) {
      followApi.isFollowing(user.userId, userId)
        .then(({ data }) => setIsFollowing(data.following)).catch(() => {});
      followApi.getMutual(user.userId, userId)
        .then(({ data }) => setMutualIds(data || [])).catch(() => {});
    }
  }, [userId, user]);

  const toggleFollow = async () => {
    if (!user || user.role === 'GUEST') return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followApi.unfollow(user.userId, userId);
        setIsFollowing(false);
        setCounts(c => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      } else {
        await followApi.follow(user.userId, userId);
        setIsFollowing(true);
        setCounts(c => ({ ...c, followers: c.followers + 1 }));
      }
    } catch {}
    setFollowLoading(false);
  };

  const openModal = async (type) => {
    setShowModal(type); setLoadingModal(true); setModalUsers([]);
    try {
      const { data: ids } = type === 'followers'
        ? await followApi.getFollowers(userId)
        : await followApi.getFollowing(userId);
      if (!ids?.length) { setLoadingModal(false); return; }
      const users = await Promise.all(
        ids.map(id => authApi.getUserById(id).then(r => r.data).catch(() => null))
      );
      setModalUsers(users.filter(Boolean));
    } catch {}
    setLoadingModal(false);
  };

  /* Open "who reacted" modal for a post */
  const openReactors = async (post) => {
    setSelectedPost(post);
    setReactorsModal(true);
    setLoadingReactors(true);
    setReactors([]);
    try {
      const { data: likes } = await likeApi.getReactions(post.postId, 'POST');
      /* Fetch username for each reactor */
      const enriched = await Promise.all(
        likes.map(async (like) => {
          try {
            const { data: u } = await authApi.getUserById(like.userId);
            return { ...like, username: u.username, profilePicture: u.profilePicture, fullName: u.fullName };
          } catch {
            return { ...like, username: `User ${like.userId}` };
          }
        })
      );
      setReactors(enriched);
    } catch {}
    setLoadingReactors(false);
  };

  const handleDeletePost = async (postId) => {
    try { await postApi.delete(postId); } catch {}
    setPosts(prev => prev.filter(p => p.postId !== postId));
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      await authApi.reportUser(userId, reportReason);
      setReported(true); setShowReport(false); setReportReason('');
    } catch {}
  };

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="card overflow-hidden mb-4">
        <div className="h-40 skeleton" />
        <div className="px-6 pb-6 pt-3">
          <div className="w-24 h-24 rounded-full skeleton -mt-12 mb-4 border-4 border-white" />
          <div className="h-5 skeleton rounded w-40 mb-2" />
          <div className="h-3 skeleton rounded w-24 mb-4" />
          <div className="flex gap-6">
            {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded w-16" />)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5">

      {/* ── Profile Card ── */}
      <div className="card mb-4 overflow-hidden">

        {/* Cover photo */}
        <div className="relative h-36 sm:h-52 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          {profileUser?.coverPicture && (
            <img src={profileUser.coverPicture} alt="cover" className="w-full h-full object-cover" />
          )}
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          {isOwnProfile && (
            <Link to="/edit-profile"
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              Edit cover
            </Link>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-4">
            {/* Profile picture */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex-shrink-0">
                {profileUser?.profilePicture ? (
                  <img
                    src={profileUser.profilePicture}
                    alt={profileUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-4xl">
                    {(profileUser?.username?.[0] || 'U').toUpperCase()}
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <Link to="/edit-profile"
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </Link>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-16 sm:mt-20">
              {isOwnProfile ? (
                <Link to="/edit-profile" className="btn-outline text-sm py-2 px-4">
                  Edit Profile
                </Link>
              ) : user && user.role !== 'GUEST' ? (
                <>
                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className={`text-sm py-2 px-5 rounded-lg font-semibold transition-all ${
                      isFollowing
                        ? 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 border border-slate-200'
                        : 'btn-primary'
                    }`}
                  >
                    {followLoading ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
                  </button>
                  {!reported ? (
                    <button
                      onClick={() => setShowReport(true)}
                      className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Report user"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium self-center">✓ Reported</span>
                  )}
                </>
              ) : (
                <Link to="/login" className="btn-primary text-sm py-2 px-4">Follow</Link>
              )}

              {/* Get Verified button — only on own profile, only if not already verified */}
              {isOwnProfile && !profileUser?.verified && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="text-sm py-2 px-4 rounded-lg font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                >
                  ✓ Get Verified
                </button>
              )}
              {isOwnProfile && profileUser?.verified && (
                <span className="text-sm font-semibold text-indigo-600 flex items-center gap-1">✓ Verified</span>
              )}
            </div>
          </div>

          {/* Name + bio */}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight flex items-center gap-2">
            <span>{profileUser?.fullName || profileUser?.username || `User #${userId}`}</span>
            {profileUser?.verified && (
              <span className="text-sm font-semibold text-indigo-600">✓ Verified</span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">@{profileUser?.username}</p>
          {profileUser?.bio && (
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">{profileUser.bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{posts.length}</p>
              <p className="text-xs text-slate-400 font-medium">Posts</p>
            </div>
            <button onClick={() => openModal('followers')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-xl font-bold text-slate-800">{counts.followers}</p>
              <p className="text-xs text-slate-400 font-medium">Followers</p>
            </button>
            <button onClick={() => openModal('following')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-xl font-bold text-slate-800">{counts.following}</p>
              <p className="text-xs text-slate-400 font-medium">Following</p>
            </button>
          </div>
        </div>
      </div>

      {/* ── Posts ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Posts</p>
        {posts.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">No posts yet</p>
            {isOwnProfile && <p className="text-sm text-slate-400">Share your first post!</p>}
          </div>
        ) : (
          posts.map(post => (
            <div key={post.postId}>
              <PostCard post={post} onDelete={handleDeletePost} />
              {/* "Who reacted" button — only show if post has likes */}
              {post.likesCount > 0 && (
                <div className="flex justify-end px-1 -mt-2 mb-3">
                  <button
                    onClick={() => openReactors(post)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    See who reacted
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Followers / Following Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 capitalize">{showModal}</h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {loadingModal ? (
                <p className="text-center text-slate-400 py-8 text-sm">Loading…</p>
              ) : modalUsers.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No {showModal} yet.</p>
              ) : modalUsers.map(u => (
                <Link key={u.userId} to={`/profile/${u.userId}`} onClick={() => setShowModal(null)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <Avatar src={u.profilePicture} name={u.username} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{u.fullName || u.username}</p>
                    <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                  </div>
                  {mutualIds.includes(u.userId) && (
                    <span className="badge badge-purple flex-shrink-0">Mutual</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Who Reacted Modal ── */}
      {reactorsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setReactorsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Reactions</h3>
              <button onClick={() => setReactorsModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {loadingReactors ? (
                <p className="text-center text-slate-400 py-8 text-sm">Loading…</p>
              ) : reactors.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No reactions yet.</p>
              ) : reactors.map((r, i) => (
                <Link key={r.likeId || i} to={`/profile/${r.userId}`} onClick={() => setReactorsModal(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <Avatar src={r.profilePicture} name={r.username} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{r.fullName || r.username}</p>
                    <p className="text-xs text-slate-400 truncate">@{r.username}</p>
                  </div>
                  <span className="text-xl flex-shrink-0">{EMOJI[r.reactionType] || '👍'}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-1">Report this account</h3>
            <p className="text-sm text-slate-400 mb-4">Tell us why you're reporting @{profileUser?.username}</p>
            <textarea
              className="input-field resize-none text-sm mb-3" rows={3}
              placeholder="Describe the issue…"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleReport}
                className="flex-1 bg-red-500 text-white text-sm py-2.5 rounded-lg hover:bg-red-600 font-semibold transition-colors">
                Submit Report
              </button>
              <button onClick={() => { setShowReport(false); setReportReason(''); }}
                className="flex-1 btn-outline text-sm py-2.5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayment && (
        <PaymentModal
          type="VERIFIED_BADGE"
          user={user}
          onSuccess={(msg) => {
            setShowPayment(false);
            setPaymentMsg(msg);
            setProfileUser(prev => ({ ...prev, verified: true }));
            setTimeout(() => setPaymentMsg(''), 5000);
          }}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* ── Payment success toast ── */}
      {paymentMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg z-50">
          {paymentMsg}
        </div>
      )}
    </div>
  );
}
