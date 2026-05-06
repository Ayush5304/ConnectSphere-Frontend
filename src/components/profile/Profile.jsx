import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { postApi, followApi, authApi, mediaApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../feed/PostCard';
import PaymentModal from '../payment/PaymentModal';
import Avatar from '../ui/Avatar';

const tabs = [
  { key: 'grid', label: 'Posts', icon: 'Grid' },
  { key: 'reels', label: 'Reels', icon: 'Play' },
  { key: 'tagged', label: 'Tagged', icon: '@' },
];

const normalizeCounts = (data) => ({
  followers: Number(data?.followers ?? data?.followersCount ?? 0),
  following: Number(data?.following ?? data?.followingCount ?? 0),
});

const getPostMedia = (post) => resolveMediaUrl(post?.mediaUrl || post?.media || post?.imageUrl || '');
const isVideoPost = (post) => /\.(mp4|webm|ogg|mov)$/i.test(getPostMedia(post));

function VerifiedBadge() {
  return <span className="inline-flex items-center text-[13px] font-black text-blue-500" title="Verified">Verified</span>;
}

function EmptyPanel({ title, subtitle }) {
  return (
    <div className="card p-10 sm:p-14 text-center">
      <div className="w-16 h-16 rounded-full border-2 border-neutral-900 flex items-center justify-center mx-auto mb-4 text-2xl font-black">+</div>
      <p className="font-black text-xl mb-1">{title}</p>
      <p className="text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedPost, setSelectedPost] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [modalUsers, setModalUsers] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');

  const isOwnProfile = user && String(user.userId) === String(userId);
  const displayName = profileUser?.fullName || profileUser?.username || `User #${userId}`;
  const visiblePosts = useMemo(() => posts.filter(p => !p.deleted), [posts]);
  const reelPosts = useMemo(() => visiblePosts.filter(isVideoPost), [visiblePosts]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRes, countsRes] = await Promise.all([
        authApi.getUserById(userId),
        followApi.getCounts(userId).catch(() => ({ data: { followers: 0, following: 0 } })),
      ]);

      if (userRes.data?.role === 'ADMIN') {
        navigate(user?.role === 'ADMIN' ? '/admin' : '/', { replace: true });
        return;
      }

      setProfileUser(userRes.data);
      setCounts(normalizeCounts(countsRes.data));

      const [postsRes, storiesRes] = await Promise.all([
        postApi.getByUser(userId).catch(async () => {
          const fallback = await postApi.getFeed();
          return { data: (fallback.data || []).filter(p => String(p.userId) === String(userId)) };
        }),
        mediaApi.getStoriesByUser(userId).catch(() => ({ data: [] })),
      ]);

      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setStories(Array.isArray(storiesRes.data) ? storiesRes.data : []);
    } catch (err) {
      setError(err.message || 'Could not load this profile.');
    } finally {
      setLoading(false);
    }

    if (user && !isOwnProfile && user.role !== 'GUEST') {
      followApi.isFollowing(user.userId, userId)
        .then(({ data }) => setIsFollowing(Boolean(data?.following)))
        .catch(() => setIsFollowing(false));
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId, user?.userId]);

  const toggleFollow = async () => {
    if (!user || user.role === 'GUEST') return navigate('/login');
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
    } finally {
      setFollowLoading(false);
    }
  };

  const openModal = async (type) => {
    setShowModal(type);
    setLoadingModal(true);
    setModalUsers([]);
    try {
      const { data: ids } = type === 'followers'
        ? await followApi.getFollowers(userId)
        : await followApi.getFollowing(userId);
      const users = await Promise.all((ids || []).map(id => authApi.getUserById(id).then(r => r.data).catch(() => null)));
      setModalUsers(users.filter(Boolean));
    } finally {
      setLoadingModal(false);
    }
  };

  const handleDeletePost = async (postId) => {
    await postApi.delete(postId).catch(() => {});
    setPosts(prev => prev.filter(p => p.postId !== postId));
    setSelectedPost(null);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    await authApi.reportUser(userId, reportReason.trim()).catch(() => {});
    setReported(true);
    setShowReport(false);
    setReportReason('');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-32 skeleton rounded mb-5" />
        <div className="grid grid-cols-3 gap-1">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-square skeleton" />)}</div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24">
      {error && (
        <div className="card p-4 mb-4 bg-rose-50 border-rose-200">
          <p className="text-sm font-bold text-rose-600">{error}</p>
          <button type="button" onClick={loadProfile} className="text-xs font-black text-blue-500 mt-2">Retry</button>
        </div>
      )}

      <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-6">
        <div className="relative h-36 sm:h-48 bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]">
          {profileUser?.coverPicture && <img src={resolveMediaUrl(profileUser.coverPicture)} alt="cover" className="w-full h-full object-cover" />}
          {isOwnProfile && (
            <Link to="/edit-profile" className="absolute right-4 bottom-4 px-3 py-2 rounded-lg bg-black/55 text-white text-xs font-black backdrop-blur">Edit cover</Link>
          )}
        </div>

        <div className="px-4 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
            <Avatar src={profileUser?.profilePicture} name={displayName} username={profileUser?.username} className="w-24 h-24 sm:w-32 sm:h-32 text-4xl border-4 border-white shadow-md" />
            <div className="flex-1 min-w-0 sm:pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                  {displayName}
                  {profileUser?.verified && <VerifiedBadge />}
                </h1>
                {isOwnProfile ? (
                  <Link to="/edit-profile" className="btn-outline h-9 px-4">Edit profile</Link>
                ) : (
                  <button type="button" onClick={toggleFollow} disabled={followLoading} className={isFollowing ? 'btn-outline h-9 px-5' : 'btn-primary h-9 px-5'}>
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                {isOwnProfile && !profileUser?.verified && (
                  <button type="button" onClick={() => setShowPayment(true)} className="btn-outline h-9 px-4 text-amber-600">Get verified</button>
                )}
                {!isOwnProfile && user?.role !== 'GUEST' && !reported && (
                  <button type="button" onClick={() => setShowReport(true)} className="btn-ghost h-9 px-3 text-rose-600">Report</button>
                )}
              </div>
              <p className="text-sm text-neutral-500 mt-1">@{profileUser?.username || 'user'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-8 max-w-md mt-5 text-center sm:text-left">
            <div><p className="text-xl font-black">{visiblePosts.length}</p><p className="text-xs text-neutral-500 font-bold">posts</p></div>
            <button type="button" onClick={() => openModal('followers')}><p className="text-xl font-black">{counts.followers}</p><p className="text-xs text-neutral-500 font-bold">followers</p></button>
            <button type="button" onClick={() => openModal('following')}><p className="text-xl font-black">{counts.following}</p><p className="text-xs text-neutral-500 font-bold">following</p></button>
          </div>

          {profileUser?.bio && <p className="text-sm text-neutral-800 mt-4 max-w-xl whitespace-pre-wrap">{profileUser.bio}</p>}

          <div className="flex gap-4 mt-6 overflow-x-auto pb-1">
            <div className="flex-shrink-0 text-center">
              <div className="w-16 h-16 rounded-full border border-neutral-300 flex items-center justify-center text-2xl mx-auto">+</div>
              <p className="text-xs font-bold mt-1">New</p>
            </div>
            {stories.slice(0, 6).map((story, index) => (
              <button key={story.storyId || index} type="button" className="flex-shrink-0 text-center">
                <Avatar src={story.mediaUrl} name={`Story ${index + 1}`} className="w-16 h-16 text-xs border-2 border-neutral-900" />
                <p className="text-xs font-bold mt-1">Story</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-neutral-200 grid grid-cols-3 mb-1">
        {tabs.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`h-12 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 border-t-2 -mt-px ${activeTab === tab.key ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400'}`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'grid' && (visiblePosts.length ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {visiblePosts.map(post => {
            const media = getPostMedia(post);
            return (
              <button key={post.postId} type="button" onClick={() => setSelectedPost(post)} className="group relative aspect-square bg-neutral-100 overflow-hidden text-left">
                {media ? (isVideoPost(post) ? <video src={media} className="w-full h-full object-cover" muted playsInline /> : <img src={media} alt="post" className="w-full h-full object-cover" />) : (
                  <div className="w-full h-full p-4 flex items-center justify-center text-center text-sm font-bold text-neutral-700 bg-neutral-100">{post.content || 'Post'}</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition flex items-center justify-center gap-5 text-white text-sm font-black opacity-0 group-hover:opacity-100">
                  <span>Likes {post.likesCount || 0}</span><span>Comments {post.commentsCount || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : <EmptyPanel title="No posts yet" subtitle={isOwnProfile ? 'Share your first moment from the home feed.' : 'This profile has not shared anything yet.'} />)}

      {activeTab === 'reels' && (reelPosts.length ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {reelPosts.map(post => <button key={post.postId} type="button" onClick={() => setSelectedPost(post)} className="relative aspect-[9/16] bg-black overflow-hidden"><video src={getPostMedia(post)} className="w-full h-full object-cover" muted playsInline /><span className="absolute left-2 bottom-2 text-white text-xs font-black">Play</span></button>)}
        </div>
      ) : <EmptyPanel title="No reels yet" subtitle="Video posts will appear here as reels." />)}

      {activeTab === 'tagged' && <EmptyPanel title="No tagged posts" subtitle="Posts that mention this profile can be shown here when tagging is enabled." />}

      {selectedPost && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-0 sm:p-5" onClick={() => setSelectedPost(null)}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <PostCard post={selectedPost} onDelete={handleDeletePost} />
          </div>
          <button type="button" onClick={() => setSelectedPost(null)} className="fixed top-4 right-5 text-white text-3xl">x</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/55 z-[75] flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-white rounded-lg w-full max-w-sm max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between"><h3 className="font-black capitalize">{showModal}</h3><button onClick={() => setShowModal(null)} className="text-2xl">x</button></div>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {loadingModal ? <p className="text-center text-sm text-neutral-500 py-8">Loading...</p> : modalUsers.length === 0 ? <p className="text-center text-sm text-neutral-500 py-8">No {showModal} yet.</p> : modalUsers.map(item => (
                <Link key={item.userId} to={`/profile/${item.userId}`} onClick={() => setShowModal(null)} className="flex items-center gap-3 p-3 rounded hover:bg-neutral-50">
                  <Avatar src={item.profilePicture} name={item.fullName || item.username} className="w-10 h-10 text-sm" />
                  <div className="min-w-0"><p className="font-bold text-sm truncate">{item.fullName || item.username}</p><p className="text-xs text-neutral-500 truncate">@{item.username}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/55 z-[80] flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-black mb-1">Report account</h3>
            <p className="text-sm text-neutral-500 mb-4">Tell us what is wrong with @{profileUser?.username}.</p>
            <textarea className="input-field resize-none mb-3" rows={3} value={reportReason} onChange={e => setReportReason(e.target.value)} />
            <div className="flex gap-2"><button onClick={handleReport} className="btn-danger flex-1">Submit</button><button onClick={() => setShowReport(false)} className="btn-outline flex-1">Cancel</button></div>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          type="VERIFIED_BADGE"
          user={user}
          onSuccess={(msg) => { setShowPayment(false); setPaymentMsg(msg); setProfileUser(prev => ({ ...prev, verified: true })); setTimeout(() => setPaymentMsg(''), 5000); }}
          onClose={() => setShowPayment(false)}
        />
      )}
      {paymentMsg && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-bold px-5 py-3 rounded-lg shadow-lg z-[90]">{paymentMsg}</div>}
    </main>
  );
}
