import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { postApi, followApi, authApi, mediaApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../feed/PostCard';
import PaymentModal from '../payment/PaymentModal';
import Avatar from '../ui/Avatar';
import verifiedBadge from '../../assets/verified-badge.svg';

const PROFILE_OVERRIDES_KEY = 'connectsphere-profile-overrides';
const STORY_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

const getProfileOverride = (userId) => {
  try {
    const overrides = JSON.parse(localStorage.getItem(PROFILE_OVERRIDES_KEY) || '{}');
    return overrides[String(userId)] || null;
  } catch {
    return null;
  }
};

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

const storyTimeAgo = (value) => {
  if (!value) return 'Added just now';
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return 'Added just now';
  const diff = Math.max(0, Date.now() - created);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Added just now';
  if (minutes < 60) return 'Added ' + minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'Added ' + hours + 'h ago';
  return 'Expired';
};

function VerifiedBadge() {
  return (
    <img
      src={verifiedBadge}
      alt="Verified"
      title="Verified"
      className="inline-block w-5 h-5 sm:w-[22px] sm:h-[22px] align-middle -ml-1"
      draggable="false"
    />
  );
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
  const [followRequested, setFollowRequested] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedPost, setSelectedPost] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [modalUsers, setModalUsers] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalMenu, setModalMenu] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyError, setStoryError] = useState('');
  const [storyUploading, setStoryUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState('photo');
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const isOwnProfile = user && String(user.userId) === String(userId);
  const displayName = profileUser?.fullName || profileUser?.username || `User #${userId}`;
  const isVerified = profileUser?.verified === true || profileUser?.verified === 'true';
  const isPrivateProfile = profileUser?.privateAccount === true || profileUser?.privateAccount === 'true';
  const canViewPrivateContent = isOwnProfile || !isPrivateProfile || isFollowing;
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

      const mergedUser = { ...userRes.data, ...(getProfileOverride(userId) || {}) };
      setProfileUser(mergedUser);
      setCounts(normalizeCounts(countsRes.data));

      let viewerFollowsProfile = false;
      if (user && String(user.userId) !== String(userId) && user.role !== 'GUEST') {
        const { data } = await followApi.getRelationshipStatus(user.userId, userId).catch(() => ({ data: { following: false, requested: false } }));
        viewerFollowsProfile = Boolean(data?.following);
        setIsFollowing(viewerFollowsProfile);
        setFollowRequested(Boolean(data?.requested || data?.status === 'REQUESTED'));
      } else {
        setIsFollowing(false);
        setFollowRequested(false);
      }
      setPrivacyChecked(true);

      const privateProfile = mergedUser.privateAccount === true || mergedUser.privateAccount === 'true';
      const canView = String(user?.userId) === String(userId) || !privateProfile || viewerFollowsProfile;
      if (!canView) {
        setPosts([]);
        setStories([]);
        return;
      }

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


  };

  useEffect(() => {
    loadProfile();
  }, [userId, user?.userId]);

  const refreshFollowCounts = async () => {
    const { data } = await followApi.getCounts(userId).catch(() => ({ data: counts }));
    const nextCounts = normalizeCounts(data);
    setCounts(nextCounts);
    return nextCounts;
  };

  const refreshFollowState = async () => {
    if (!user || String(user.userId) === String(userId) || user.role === 'GUEST') return false;
    const { data } = await followApi.getRelationshipStatus(user.userId, userId).catch(() => ({ data: { following: false, requested: false } }));
    const next = Boolean(data?.following);
    setIsFollowing(next);
    setFollowRequested(Boolean(data?.requested || data?.status === 'REQUESTED'));
    return next;
  };

  const toggleFollow = async () => {
    if (!user || user.role === 'GUEST') return navigate('/login');
    setFollowLoading(true);
    try {
      if (isFollowing || followRequested) {
        await followApi.unfollow(user.userId, userId);
        setIsFollowing(false);
        setFollowRequested(false);
      } else {
        const { data } = await followApi.follow(user.userId, userId);
        const requested = Boolean(data?.requested || data?.status === 'REQUESTED');
        setIsFollowing(Boolean(data?.following || data?.status === 'FOLLOWING'));
        setFollowRequested(requested);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || '';
      if (status === 409 || /already following/i.test(message)) {
        setIsFollowing(true);
        setFollowRequested(false);
      } else {
        await refreshFollowState();
      }
    } finally {
      await refreshFollowCounts();
      setFollowLoading(false);
      if (!isFollowing && isPrivateProfile && !followRequested) loadProfile();
    }
  };

  const openModal = async (type) => {
    setShowModal(type);
    setModalSearch('');
    setModalMenu(null);
    setLoadingModal(true);
    setModalUsers([]);
    try {
      const { data: ids } = type === 'followers'
        ? await followApi.getFollowers(userId)
        : await followApi.getFollowing(userId);
      const users = await Promise.all((ids || []).map(id => authApi.getUserById(id).then(r => r.data).catch(() => null)));
      setModalUsers(users.filter(Boolean));
      await refreshFollowCounts();
    } finally {
      setLoadingModal(false);
    }
  };

  const removeFollower = async (followerId) => {
    await followApi.unfollow(followerId, userId).catch(() => {});
    setModalUsers(prev => prev.filter(item => String(item.userId) !== String(followerId)));
    await refreshFollowCounts();
  };

  const unfollowFromModal = async (targetId) => {
    await followApi.unfollow(user.userId, targetId).catch(() => {});
    setModalUsers(prev => prev.filter(item => String(item.userId) !== String(targetId)));
    await refreshFollowCounts();
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

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
    }
    cameraStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setCameraOpen(false);
    setCameraReady(false);
    setRecording(false);
  };

  const resetStoryCreator = () => {
    stopCamera();
    if (storyPreview) URL.revokeObjectURL(storyPreview);
    setStoryFile(null);
    setStoryPreview('');
    setStoryError('');
    setShowStoryCreator(false);
  };

  const setCapturedStoryFile = (file) => {
    stopCamera();
    setCapturedStoryFile(file);
    setStoryError('');
  };

  const startCamera = async (mode = cameraMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStoryError('Camera is not available in this browser. Please use file upload.');
      return;
    }
    stopCamera();
    setCameraMode(mode);
    setStoryError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: mode === 'video'
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      setCameraReady(true);
      window.setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (err) {
      setStoryError('Camera permission was blocked or unavailable. Allow camera access and try again.');
      setCameraOpen(false);
      setCameraReady(false);
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || !cameraStreamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setStoryError('Could not capture photo. Please try again.');
        return;
      }
      const file = new File([blob], 'camera-story-' + Date.now() + '.jpg', { type: 'image/jpeg' });
      setCapturedStoryFile(file);
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const startRecording = () => {
    if (!cameraStreamRef.current || recording) return;
    recordedChunksRef.current = [];
    const preferredType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: preferredType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      if (!blob.size) {
        setStoryError('Could not record video. Please try again.');
        return;
      }
      const file = new File([blob], 'camera-story-' + Date.now() + '.webm', { type: 'video/webm' });
      setCapturedStoryFile(file);
      stopCamera();
    };
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  useEffect(() => () => stopCamera(), []);

  const handleStoryFile = (event) => {
    const file = event.target.files?.[0];
    setStoryError('');
    if (!file) return;
    if (!STORY_ALLOWED_TYPES.includes(file.type)) {
      setStoryFile(null);
      setStoryPreview('');
      setStoryError('Only JPEG, PNG, WebP images, MP4 videos, and WebM camera clips are allowed.');
      event.target.value = '';
      return;
    }
    if (storyPreview) URL.revokeObjectURL(storyPreview);
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const removeStoryDraft = () => {
    stopCamera();
    if (storyPreview) URL.revokeObjectURL(storyPreview);
    setStoryFile(null);
    setStoryPreview('');
    setStoryError('');
  };

  const retakeStory = () => {
    const nextMode = storyFile?.type?.startsWith('video/') ? 'video' : 'photo';
    removeStoryDraft();
    startCamera(nextMode);
  };

  const createStoryFromProfile = async () => {
    if (!user || user.role === 'GUEST') return navigate('/login');
    if (!isOwnProfile) return;
    if (!storyFile) {
      setStoryError('Please choose an image or video story first.');
      return;
    }
    setStoryUploading(true);
    setStoryError('');
    try {
      const formData = new FormData();
      formData.append('file', storyFile);
      formData.append('userId', user.userId);
      formData.append('username', user.username);
      const { data } = await mediaApi.createStory(formData);
      const created = { ...data, createdAt: data.createdAt || new Date().toISOString(), mediaUrl: resolveMediaUrl(data.mediaUrl) };
      setStories(prev => [created, ...prev]);
      resetStoryCreator();
    } catch (err) {
      const msg = err.response?.data;
      setStoryError(typeof msg === 'string' ? msg : msg?.message || err.message || 'Could not create story.');
    } finally {
      setStoryUploading(false);
    }
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
                  {isVerified && <VerifiedBadge />}
                </h1>
                {isOwnProfile ? (
                  <Link to="/edit-profile" className="btn-outline h-9 px-4">Edit profile</Link>
                ) : (
                  <button type="button" onClick={toggleFollow} disabled={followLoading} className={(isFollowing || followRequested) ? 'btn-outline h-9 px-5' : 'btn-primary h-9 px-5'}>
                    {followLoading ? '...' : isFollowing ? 'Following' : followRequested ? 'Requested' : 'Follow'}
                  </button>
                )}
                {!isOwnProfile && user?.role !== 'GUEST' && (
                  <Link to={`/messages?user=${userId}`} className="btn-outline h-9 px-5">Message</Link>
                )}
                {isOwnProfile && !isVerified && (
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

          {profileUser?.bio && (
            <p className="mt-4 max-w-xl whitespace-pre-wrap text-[15px] font-medium leading-snug text-neutral-900">
              {profileUser.bio}
            </p>
          )}

          <div className="flex gap-4 mt-6 overflow-x-auto pb-1">
            {isOwnProfile && (
              <button type="button" onClick={() => setShowStoryCreator(true)} className="flex-shrink-0 text-center group">
                <span className="w-16 h-16 rounded-full border border-neutral-300 bg-white flex items-center justify-center text-2xl mx-auto transition group-hover:border-neutral-900 group-hover:scale-105 group-hover:shadow-md">+</span>
                <span className="block text-xs font-bold mt-1">New</span>
              </button>
            )}
            {stories.slice(0, 6).map((story, index) => (
              <button key={story.storyId || index} type="button" className="flex-shrink-0 text-center">
                <Avatar src={story.mediaUrl} name={`Story ${index + 1}`} className="w-16 h-16 text-xs border-2 border-neutral-900" />
                <p className="text-xs font-bold mt-1">Story</p>
                <p className="text-[11px] text-neutral-500 leading-tight max-w-[76px] truncate">{storyTimeAgo(story.createdAt || story.created_at || story.updatedAt)}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {isPrivateProfile && !canViewPrivateContent && privacyChecked && (
        <section className="card p-10 sm:p-14 text-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-neutral-900 flex items-center justify-center mx-auto mb-4 text-2xl font-black">Lock</div>
          <p className="font-black text-xl mb-1">This Account is Private</p>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-5">Follow @{profileUser?.username || 'this user'} to see their photos, stories, reels, followers activity, and profile content.</p>
          {!user || user.role === 'GUEST' ? <Link to="/login" className="btn-primary">Log in to follow</Link> : <button type="button" onClick={toggleFollow} disabled={followLoading} className="btn-primary">{followLoading ? '...' : followRequested ? 'Requested' : 'Follow'}</button>}
        </section>
      )}

      {canViewPrivateContent && <>
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
        <div className="fixed inset-0 bg-black/60 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(null)}>
          <div className="bg-white w-full sm:max-w-md max-h-[86vh] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <button className="w-9 h-9 text-xl" onClick={() => setShowModal(null)}>Back</button>
              <h3 className="font-black">{profileUser?.username}</h3>
              <button onClick={() => setShowModal(null)} className="w-9 h-9 rounded-full bg-neutral-100 text-xl">x</button>
            </div>
            <div className="grid grid-cols-2 border-b border-neutral-200 text-sm font-black">
              <button onClick={() => openModal('followers')} className={`py-3 border-b-2 ${showModal === 'followers' ? 'border-neutral-950' : 'border-transparent text-neutral-500'}`}>{counts.followers} followers</button>
              <button onClick={() => openModal('following')} className={`py-3 border-b-2 ${showModal === 'following' ? 'border-neutral-950' : 'border-transparent text-neutral-500'}`}>{counts.following} following</button>
            </div>
            <div className="p-3 border-b border-neutral-100">
              <input value={modalSearch} onChange={e => setModalSearch(e.target.value)} className="w-full h-11 rounded-xl bg-neutral-100 px-4 outline-none text-sm" placeholder="Search" />
            </div>
            <div className="p-2 max-h-[56vh] overflow-y-auto">
              {loadingModal ? <p className="text-center text-sm text-neutral-500 py-8">Loading...</p> : modalUsers.filter(item => {
                const q = modalSearch.trim().toLowerCase();
                return !q || `${item.fullName || ''} ${item.username || ''}`.toLowerCase().includes(q);
              }).length === 0 ? <p className="text-center text-sm text-neutral-500 py-8">No {showModal} yet.</p> : modalUsers.filter(item => {
                const q = modalSearch.trim().toLowerCase();
                return !q || `${item.fullName || ''} ${item.username || ''}`.toLowerCase().includes(q);
              }).map(item => (
                <div key={item.userId} className="relative flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50">
                  <Link to={`/profile/${item.userId}`} onClick={() => setShowModal(null)}><Avatar src={item.profilePicture} name={item.fullName || item.username} className="w-12 h-12 text-sm" /></Link>
                  <Link to={`/profile/${item.userId}`} onClick={() => setShowModal(null)} className="min-w-0 flex-1">
                    <p className="font-black text-sm truncate">{item.fullName || item.username}</p>
                    <p className="text-xs text-neutral-500 truncate">@{item.username}</p>
                  </Link>
                  <Link to={`/messages?user=${item.userId}`} onClick={() => setShowModal(null)} className="px-4 py-2 rounded-lg bg-neutral-100 text-xs font-black">Message</Link>
                  {isOwnProfile && showModal === 'followers' && <button onClick={() => removeFollower(item.userId)} className="text-xl text-neutral-500 px-1">x</button>}
                  {isOwnProfile && showModal === 'following' && (
                    <div className="relative">
                      <button onClick={() => setModalMenu(modalMenu === item.userId ? null : item.userId)} className="text-xl px-1">...</button>
                      {modalMenu === item.userId && (
                        <div className="absolute right-0 top-8 w-44 rounded-xl bg-neutral-900 text-white shadow-xl overflow-hidden z-10">
                          <Link to={`/messages?user=${item.userId}`} onClick={() => setShowModal(null)} className="block px-4 py-3 text-sm">Message</Link>
                          <button onClick={() => unfollowFromModal(item.userId)} className="w-full text-left px-4 py-3 text-sm text-red-400">Unfollow</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </>}


      {showStoryCreator && (
        <div className="story-modal-backdrop fixed inset-0 bg-black/70 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={resetStoryCreator}>
          <div className="story-composer-shell bg-white w-full sm:max-w-6xl rounded-t-[32px] sm:rounded-[34px] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.35)] border border-white/70" onClick={e => e.stopPropagation()}>
            <div className="h-16 px-4 sm:px-6 border-b border-neutral-200 flex items-center justify-between bg-white/90 backdrop-blur">
              <button type="button" onClick={resetStoryCreator} className="w-11 h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 transition text-xl font-black">x</button>
              <div className="text-center">
                <h3 className="font-black text-xl tracking-tight">Create story</h3>
                <p className="hidden sm:block text-xs text-neutral-500 font-semibold">Upload, capture, or record a 24-hour moment</p>
              </div>
              <button type="button" onClick={createStoryFromProfile} disabled={!storyFile || storyUploading} className="h-11 px-5 rounded-full bg-blue-500 text-white font-black shadow-lg shadow-blue-500/20 hover:bg-blue-600 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none transition">
                {storyUploading ? 'Posting...' : 'Share'}
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,430px)_1fr] gap-0 bg-[radial-gradient(circle_at_top_left,rgba(214,41,118,0.09),transparent_35%),linear-gradient(180deg,#ffffff,#fafafa)]">
              <section className="p-5 sm:p-7 flex justify-center bg-neutral-950 xl:bg-transparent">
                <div className="story-preview-card relative w-full max-w-[350px] aspect-[9/14] rounded-[32px] overflow-hidden bg-neutral-950 border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)] flex items-center justify-center text-center">
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_10%,rgba(253,186,116,0.35),transparent_26%),radial-gradient(circle_at_90%_20%,rgba(214,41,118,0.30),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(79,91,213,0.25),transparent_35%)]" />
                  {cameraOpen ? (
                    <video ref={cameraVideoRef} className="relative z-10 w-full h-full object-cover" muted playsInline autoPlay />
                  ) : storyPreview ? (
                    storyFile?.type?.startsWith('video/') ? <video src={storyPreview} className="relative z-10 w-full h-full object-contain" controls muted /> : <img src={storyPreview} alt="Story preview" className="relative z-10 w-full h-full object-contain" />
                  ) : (
                    <div className="relative z-10 px-8 text-white story-empty-pulse">
                      <div className="w-20 h-20 rounded-full g-primary mx-auto mb-5 flex items-center justify-center text-4xl font-black shadow-2xl">+</div>
                      <p className="font-black text-2xl leading-tight">Add to your story</p>
                      <p className="text-sm text-white/60 mt-3">Choose a file, take a photo, or record a video now.</p>
                    </div>
                  )}
                  <div className="absolute left-4 right-4 top-4 z-20 flex gap-1.5">
                    <span className="h-1 flex-1 rounded-full bg-white/80" />
                    <span className="h-1 flex-1 rounded-full bg-white/25" />
                    <span className="h-1 flex-1 rounded-full bg-white/25" />
                  </div>
                  <div className="absolute left-4 bottom-4 z-20 rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                    {cameraOpen ? (recording ? 'Recording...' : 'Camera ready') : storyFile ? 'Ready to share' : 'Your story'}
                  </div>
                </div>
              </section>

              <section className="p-5 sm:p-7 space-y-5">
                <div className="story-tool-card rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-500">Create</p>
                      <h4 className="text-2xl font-black tracking-tight mt-1">Pick how to add your story</h4>
                      <p className="text-sm text-neutral-500 mt-1">Upload from gallery, take a fresh photo, or record a quick video from your camera.</p>
                    </div>
                    <span className="hidden sm:flex w-12 h-12 rounded-2xl g-primary text-white items-center justify-center font-black shadow-lg">C</span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="story-action-tile group cursor-pointer rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 hover:border-blue-400 hover:bg-blue-50 transition">
                      <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={handleStoryFile} className="hidden" />
                      <span className="flex w-12 h-12 rounded-2xl bg-white border border-neutral-200 items-center justify-center text-xl font-black group-hover:scale-110 transition">UP</span>
                      <span className="block font-black mt-3">Upload</span>
                      <span className="block text-xs text-neutral-500 mt-1">Choose media</span>
                    </label>
                    <button type="button" onClick={() => startCamera('photo')} className="story-action-tile text-left rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 hover:border-pink-400 hover:bg-pink-50 transition">
                      <span className="flex w-12 h-12 rounded-2xl bg-white border border-neutral-200 items-center justify-center text-xl font-black">PH</span>
                      <span className="block font-black mt-3">Photo</span>
                      <span className="block text-xs text-neutral-500 mt-1">Use camera</span>
                    </button>
                    <button type="button" onClick={() => startCamera('video')} className="story-action-tile text-left rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 hover:border-purple-400 hover:bg-purple-50 transition">
                      <span className="flex w-12 h-12 rounded-2xl bg-white border border-neutral-200 items-center justify-center text-xl font-black">VD</span>
                      <span className="block font-black mt-3">Video</span>
                      <span className="block text-xs text-neutral-500 mt-1">Record now</span>
                    </button>
                  </div>

                  {cameraOpen && (
                    <div className="mt-4 rounded-[24px] bg-neutral-950 text-white p-4 story-file-chip">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black">Camera capture</p>
                          <p className="text-xs text-white/60">{cameraMode === 'photo' ? 'Take a photo from your camera.' : 'Record a short camera video.'}</p>
                        </div>
                        <button type="button" onClick={stopCamera} className="rounded-full bg-white/10 px-3 py-1 text-xs font-black hover:bg-white/20">Close camera</button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {cameraMode === 'photo' ? (
                          <button type="button" onClick={capturePhoto} disabled={!cameraReady} className="h-11 px-5 rounded-full bg-white text-neutral-950 font-black disabled:opacity-50">Capture photo</button>
                        ) : recording ? (
                          <button type="button" onClick={stopRecording} className="h-11 px-5 rounded-full bg-rose-500 text-white font-black story-recording-dot">Stop recording</button>
                        ) : (
                          <button type="button" onClick={startRecording} disabled={!cameraReady} className="h-11 px-5 rounded-full bg-white text-neutral-950 font-black disabled:opacity-50">Start recording</button>
                        )}
                      </div>
                    </div>
                  )}

                  {storyFile && (
                    <div className="mt-4 rounded-[26px] overflow-hidden bg-neutral-950 text-white story-upload-ready-card story-file-chip">
                      <div className="p-4 sm:p-5 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl g-primary flex items-center justify-center font-black shadow-lg">
                          {storyFile.type?.startsWith('video/') ? 'VD' : 'PH'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Ready to upload</p>
                          <p className="font-black truncate mt-1">{storyFile.name}</p>
                          <p className="text-xs text-white/60 mt-1">{storyFile.type} - {Math.max(1, Math.round(storyFile.size / 1024))} KB</p>
                          <p className="text-sm text-white/70 mt-3">Your captured media is ready. Click upload to post it as your story.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 border-t border-white/10">
                        <button type="button" onClick={createStoryFromProfile} disabled={storyUploading} className="col-span-2 h-14 bg-white text-neutral-950 font-black hover:bg-blue-50 disabled:opacity-60 transition">
                          {storyUploading ? 'Uploading...' : 'Upload to story'}
                        </button>
                        <button type="button" onClick={retakeStory} disabled={storyUploading} className="h-14 bg-white/10 font-black hover:bg-white/15 disabled:opacity-60 transition">Retake</button>
                      </div>
                      <button type="button" onClick={removeStoryDraft} disabled={storyUploading} className="w-full h-12 border-t border-white/10 text-sm font-black text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-60 transition">Remove draft</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="story-mini-card rounded-2xl border border-neutral-200 bg-white p-4">
                    <p className="font-black text-sm">Duration</p>
                    <p className="text-xs text-neutral-500 mt-1">Visible for 24 hours</p>
                  </div>
                  <div className="story-mini-card rounded-2xl border border-neutral-200 bg-white p-4">
                    <p className="font-black text-sm">Camera</p>
                    <p className="text-xs text-neutral-500 mt-1">Photo and video capture</p>
                  </div>
                  <div className="story-mini-card rounded-2xl border border-neutral-200 bg-white p-4">
                    <p className="font-black text-sm">Format</p>
                    <p className="text-xs text-neutral-500 mt-1">Image, MP4, WebM</p>
                  </div>
                </div>

                {storyError && <p className="story-error-card rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm font-bold text-rose-600">{storyError}</p>}

                <div className="rounded-[24px] bg-neutral-100 p-4 text-sm text-neutral-600">
                  <p className="font-black text-neutral-950 mb-1">Tip for a better story</p>
                  <p>For best results, hold your phone or webcam vertically. Browser camera video is saved as WebM and posts like a normal story.</p>
                </div>
              </section>
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
