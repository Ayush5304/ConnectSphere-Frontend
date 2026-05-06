import React, { useEffect, useState, useRef, useCallback } from 'react';
import { mediaApi, followApi, resolveMediaUrl, notificationApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STORY_DURATION = 5000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const STORY_REACTIONS = ['❤️', '😂', '😮', '🔥', '👏', '😢'];

function storyTime(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return new Date(date).toLocaleDateString();
}

function Toast({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={'fixed left-1/2 top-24 z-[70] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold shadow-2xl ' + (notice.type === 'error' ? 'bg-rose-600 text-white' : 'bg-neutral-950 text-white')}>
      <button onClick={onClose} className="mr-3 text-white/70 hover:text-white">x</button>{notice.message}
    </div>
  );
}

function ConfirmModal({ story, deleting, onCancel, onConfirm }) {
  if (!story) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-6">
          <h3 className="text-xl font-black text-neutral-950">Delete story?</h3>
          <p className="mt-2 text-sm text-neutral-500">This removes the story and its media from ConnectSphere.</p>
        </div>
        <button disabled={deleting} onClick={onConfirm} className="w-full border-t border-neutral-100 px-5 py-4 text-sm font-black text-rose-600 disabled:opacity-50">
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
        <button disabled={deleting} onClick={onCancel} className="w-full border-t border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-700 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

function StoryMenu({ open, canDelete, isOwner, onDelete, onViewers, onShare, onMute, onReport, onClose }) {
  if (!open) return null;
  return (
    <div className="absolute right-4 top-16 z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-sm text-white shadow-2xl backdrop-blur" onClick={e => e.stopPropagation()}>
      {canDelete && <button onClick={onDelete} className="block w-full px-4 py-3 text-left font-bold text-rose-300 hover:bg-white/10">Delete story</button>}
      {isOwner && <button onClick={onViewers} className="block w-full px-4 py-3 text-left font-bold hover:bg-white/10">View seen list</button>}
      <button onClick={onShare} className="block w-full px-4 py-3 text-left font-bold hover:bg-white/10">Share story</button>
      {!isOwner && <button onClick={onMute} className="block w-full px-4 py-3 text-left font-bold hover:bg-white/10">Mute this user</button>}
      {!isOwner && <button onClick={onReport} className="block w-full px-4 py-3 text-left font-bold hover:bg-white/10">Report story</button>}
      <button onClick={onClose} className="block w-full px-4 py-3 text-left font-bold text-white/60 hover:bg-white/10">Close menu</button>
    </div>
  );
}

export default function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [groupedStories, setGroupedStories] = useState([]);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [failedMedia, setFailedMedia] = useState({});
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [confirmDeleteStory, setConfirmDeleteStory] = useState(null);
  const [deletingStoryId, setDeletingStoryId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingAction, setSendingAction] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mutedUserIds, setMutedUserIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mutedStoryUsers') || '[]'); } catch { return []; }
  });

  const fileRef = useRef();
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const elapsedRef = useRef(0);
  const touchStartYRef = useRef(null);

  const showNotice = (message, type = 'success') => {
    setNotice({ message, type });
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(null), 2800);
  };

  const groupStories = useCallback((allStories) => {
    const muted = new Set(mutedUserIds.map(String));
    const map = {};
    allStories
      .filter(s => String(s.userId) === String(user?.userId) || !muted.has(String(s.userId)))
      .forEach(s => {
        if (!map[s.userId]) map[s.userId] = { userId: s.userId, username: s.username, stories: [] };
        map[s.userId].stories.push({ ...s, mediaUrl: resolveMediaUrl(s.mediaUrl) });
      });
    setGroupedStories(Object.values(map));
  }, [mutedUserIds, user?.userId]);

  const loadStories = useCallback(async () => {
    if (!user || user.role === 'GUEST' || user.role === 'ADMIN') return;
    try {
      const { data: following } = await followApi.getFollowing(user.userId);
      const ids = Array.from(new Set([...(following || []), Number(user.userId)]));
      const { data } = await mediaApi.getStories(ids);
      setStories(data || []);
      groupStories(data || []);
    } catch {
      showNotice('Could not load stories.', 'error');
    }
  }, [groupStories, user]);

  useEffect(() => { loadStories(); }, [loadStories]);
  useEffect(() => { groupStories(stories); }, [mutedUserIds, stories, groupStories]);

  const currentGroup = viewingGroup !== null ? groupedStories[viewingGroup] : null;
  const currentStory = currentGroup?.stories[currentIdx];
  const currentStoryUrl = resolveMediaUrl(currentStory?.mediaUrl);
  const currentStoryFailed = currentStory && failedMedia[currentStory.storyId];
  const isOwner = currentStory && String(currentStory.userId) === String(user?.userId);
  const isAdmin = user?.role === 'ADMIN';
  const canDelete = Boolean(currentStory && (isOwner || isAdmin));

  const stopTimer = () => {
    clearInterval(timerRef.current);
    elapsedRef.current += Date.now() - (startRef.current || Date.now());
  };

  const closeViewer = useCallback(() => {
    clearInterval(timerRef.current);
    setViewingGroup(null);
    setCurrentIdx(0);
    setProgress(0);
    setShowViewers(false);
    setViewers([]);
    setStoryMenuOpen(false);
    setReplyText('');
    elapsedRef.current = 0;
  }, []);

  const recordView = useCallback(async (story) => {
    if (!user || !story || String(user.userId) === String(story.userId)) return;
    try {
      const { data: updated } = await mediaApi.incrementView(story.storyId, user.userId, user.username);
      setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, viewCount: updated.viewCount } : s));
      setGroupedStories(prev => prev.map(g => ({
        ...g,
        stories: g.stories.map(s => s.storyId === story.storyId ? { ...s, viewCount: updated.viewCount } : s)
      })));
    } catch {}
  }, [user]);

  const goNext = useCallback(async () => {
    if (viewingGroup === null) return;
    const group = groupedStories[viewingGroup];
    if (!group) return closeViewer();
    setStoryMenuOpen(false);
    setShowViewers(false);
    if (currentIdx < group.stories.length - 1) {
      const next = currentIdx + 1;
      setCurrentIdx(next);
      setProgress(0);
      elapsedRef.current = 0;
      await recordView(group.stories[next]);
    } else if (viewingGroup < groupedStories.length - 1) {
      const nextGroup = viewingGroup + 1;
      setViewingGroup(nextGroup);
      setCurrentIdx(0);
      setProgress(0);
      elapsedRef.current = 0;
      await recordView(groupedStories[nextGroup].stories[0]);
    } else {
      closeViewer();
    }
  }, [viewingGroup, groupedStories, currentIdx, closeViewer, recordView]);

  const goPrev = () => {
    if (!currentGroup) return;
    setStoryMenuOpen(false);
    setShowViewers(false);
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    } else if (viewingGroup > 0) {
      const prevGroup = viewingGroup - 1;
      setViewingGroup(prevGroup);
      setCurrentIdx(groupedStories[prevGroup].stories.length - 1);
    }
    setProgress(0);
    elapsedRef.current = 0;
  };

  const startTimer = useCallback((remaining = STORY_DURATION) => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    elapsedRef.current = STORY_DURATION - remaining;
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, 50);
  }, [goNext]);

  useEffect(() => {
    if (viewingGroup === null || storyMenuOpen || confirmDeleteStory) return;
    if (!paused) startTimer();
    return () => clearInterval(timerRef.current);
  }, [viewingGroup, currentIdx, paused, storyMenuOpen, confirmDeleteStory, startTimer]);

  const openGroup = async (groupIdx) => {
    setViewingGroup(groupIdx);
    setCurrentIdx(0);
    setProgress(0);
    setShowViewers(false);
    setViewers([]);
    setStoryMenuOpen(false);
    elapsedRef.current = 0;
    await recordView(groupedStories[groupIdx]?.stories[0]);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      showNotice('Only JPEG, PNG, WebP, and MP4 stories are allowed.', 'error');
      fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.userId);
      formData.append('username', user.username);
      const { data } = await mediaApi.createStory(formData);
      const created = { ...data, mediaUrl: resolveMediaUrl(data.mediaUrl) };
      const updated = [created, ...stories];
      setStories(updated);
      groupStories(updated);
      showNotice('Story posted.');
    } catch (err) {
      const msg = err.response?.data;
      showNotice(typeof msg === 'string' ? msg : msg?.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeStoryFromUi = (storyId) => {
    const updated = stories.filter(s => String(s.storyId) !== String(storyId));
    setStories(updated);
    groupStories(updated);
    const group = currentGroup;
    if (!group) return;
    if (group.stories.length <= 1) {
      closeViewer();
    } else if (currentIdx >= group.stories.length - 1) {
      setCurrentIdx(Math.max(0, currentIdx - 1));
      setProgress(0);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteStory) return;
    setDeletingStoryId(confirmDeleteStory.storyId);
    try {
      await mediaApi.deleteStory(confirmDeleteStory.storyId, user.userId, user.role);
      removeStoryFromUi(confirmDeleteStory.storyId);
      setConfirmDeleteStory(null);
      setStoryMenuOpen(false);
      showNotice('Story deleted.');
      loadStories();
    } catch (err) {
      showNotice(err.message || 'Could not delete story.', 'error');
    } finally {
      setDeletingStoryId(null);
    }
  };

  const loadViewers = async (storyId) => {
    setLoadingViewers(true);
    try {
      const { data } = await mediaApi.getStoryViewers(storyId);
      setViewers(data || []);
      setShowViewers(true);
    } catch {
      showNotice('Could not load viewers.', 'error');
    } finally {
      setLoadingViewers(false);
    }
  };

  const notifyStoryOwner = async (message, type) => {
    if (!currentStory || isOwner) return;
    await notificationApi.create({
      recipientId: currentStory.userId,
      actorId: user.userId,
      targetId: currentStory.storyId,
      type,
      message,
      deepLink: '/'
    }).catch(() => {});
  };

  const sendReaction = async (reaction) => {
    if (!currentStory || sendingAction) return;
    setSendingAction(true);
    await notifyStoryOwner(user.username + ' reacted ' + reaction + ' to your story.', 'STORY_REACTION');
    showNotice('Reaction sent ' + reaction);
    setSendingAction(false);
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory || sendingAction) return;
    setSendingAction(true);
    await notifyStoryOwner(user.username + ' replied to your story: ' + replyText.trim(), 'STORY_REPLY');
    setReplyText('');
    showNotice('Reply sent.');
    setSendingAction(false);
  };

  const shareStory = async () => {
    if (!currentStoryUrl) return;
    try {
      await navigator.clipboard.writeText(currentStoryUrl);
      showNotice('Story link copied.');
    } catch {
      showNotice('Could not copy story link.', 'error');
    }
    setStoryMenuOpen(false);
  };

  const muteCurrentUser = () => {
    if (!currentStory || isOwner) return;
    const next = Array.from(new Set([...mutedUserIds.map(String), String(currentStory.userId)]));
    localStorage.setItem('mutedStoryUsers', JSON.stringify(next));
    setMutedUserIds(next);
    showNotice('Muted ' + currentStory.username + "'s stories.");
    closeViewer();
  };

  const reportCurrentStory = async () => {
    const reason = window.prompt('Why are you reporting this story?');
    if (!reason?.trim() || !currentStory) return;
    try {
      await mediaApi.reportStory(currentStory.storyId, reason.trim());
      await notifyStoryOwner('Your story was reported for review.', 'STORY_REPORT');
      showNotice('Story reported.');
    } catch {
      showNotice('Could not report story.', 'error');
    }
    setStoryMenuOpen(false);
  };

  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
    setPaused(true);
    stopTimer();
  };

  const handleTouchEnd = (e) => {
    const startY = touchStartYRef.current;
    const endY = e.changedTouches[0].clientY;
    touchStartYRef.current = null;
    if (startY !== null && endY - startY > 80) {
      closeViewer();
      return;
    }
    setPaused(false);
    startTimer(STORY_DURATION - elapsedRef.current);
  };

  if (!user || user.role === 'GUEST' || user.role === 'ADMIN') return null;

  return (
    <>
      <Toast notice={notice} onClose={() => setNotice(null)} />
      <div className="card cinema-card-hover mb-4 flex items-center gap-4 overflow-x-auto px-4 py-4">
        <div className="flex flex-shrink-0 flex-col items-center">
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-neutral-300 bg-white text-2xl font-light text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
            {uploading ? '...' : '+'}
          </button>
          <span className="mt-1.5 w-16 truncate text-center text-xs text-neutral-600">Your story</span>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden" onChange={handleUpload} />
        </div>

        {groupedStories.map((group, gIdx) => {
          const cover = resolveMediaUrl(group.stories[0]?.mediaUrl);
          return (
            <div key={group.userId} onClick={() => openGroup(gIdx)} className="flex flex-shrink-0 cursor-pointer flex-col items-center">
              <div className="story-ring h-16 w-16 overflow-hidden">
                <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-neutral-100">
                  {cover?.match(/\.(mp4|webm|ogg)$/i)
                    ? <video src={cover} className="h-full w-full object-cover" muted />
                    : <img src={cover} alt={group.username} className="h-full w-full object-cover" />}
                </div>
              </div>
              <span className="mt-1.5 w-16 truncate text-center text-xs font-medium text-neutral-700">{group.username}</span>
              {String(group.userId) === String(user.userId) && <span className="text-[11px] text-neutral-400">{group.stories.reduce((sum, s) => sum + (s.viewCount || 0), 0)} views</span>}
            </div>
          );
        })}
      </div>

      {currentStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          onMouseDown={() => { setPaused(true); stopTimer(); }}
          onMouseUp={() => { setPaused(false); startTimer(STORY_DURATION - elapsedRef.current); }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div className="relative flex h-screen max-h-screen w-full max-w-sm flex-col overflow-hidden bg-black" onClick={e => e.stopPropagation()}>
            <div className="absolute left-0 right-0 top-0 z-30 flex gap-1 p-2">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div className="h-full rounded-full bg-white" style={{ width: i < currentIdx ? '100%' : i === currentIdx ? progress + '%' : '0%' }} />
                </div>
              ))}
            </div>

            <div className="absolute left-0 right-0 top-4 z-30 flex items-center gap-3 px-4 pt-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-black text-white">
                {currentStory.username?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{currentStory.username}</p>
                <p className="text-xs text-white/60">{storyTime(currentStory.createdAt)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setStoryMenuOpen(v => !v); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white backdrop-blur hover:bg-white/20">...</button>
              <button onClick={closeViewer} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white backdrop-blur hover:bg-white/20">x</button>
            </div>

            <StoryMenu
              open={storyMenuOpen}
              canDelete={canDelete}
              isOwner={isOwner}
              onDelete={() => { setConfirmDeleteStory(currentStory); setStoryMenuOpen(false); }}
              onViewers={() => { loadViewers(currentStory.storyId); setStoryMenuOpen(false); }}
              onShare={shareStory}
              onMute={muteCurrentUser}
              onReport={reportCurrentStory}
              onClose={() => setStoryMenuOpen(false)}
            />

            <div className="flex flex-1 items-center justify-center bg-black">
              {currentStoryFailed ? (
                <div className="px-8 text-center text-white">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">!</div>
                  <p className="text-lg font-bold">Story media is unavailable</p>
                  <p className="mt-2 break-all text-sm text-white/60">{currentStoryUrl || 'Missing media URL'}</p>
                </div>
              ) : currentStoryUrl?.match(/\.(mp4|webm|ogg)$/i)
                ? <video key={currentStory.storyId} src={currentStoryUrl} autoPlay muted controls onError={() => setFailedMedia(prev => ({ ...prev, [currentStory.storyId]: true }))} className="h-full max-h-screen w-full object-contain" />
                : <img key={currentStory.storyId} src={currentStoryUrl} alt="story" onError={() => setFailedMedia(prev => ({ ...prev, [currentStory.storyId]: true }))} className="h-full max-h-screen w-full object-contain" />}
            </div>

            <div className="pointer-events-none absolute inset-0 z-10 flex">
              <div className="pointer-events-auto h-full w-1/3" onClick={(e) => { e.stopPropagation(); goPrev(); }} />
              <div className="h-full w-1/3" />
              <div className="pointer-events-auto h-full w-1/3" onClick={(e) => { e.stopPropagation(); goNext(); }} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-20">
              {isOwner ? (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <button onClick={(e) => { e.stopPropagation(); showViewers ? setShowViewers(false) : loadViewers(currentStory.storyId); }} className="flex items-center gap-2 text-sm text-white/80 hover:text-white">
                    <span>{currentStory.viewCount || 0}</span><span>{showViewers ? 'Hide viewers' : 'Seen by'}</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteStory(currentStory); }} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-rose-200 backdrop-blur hover:bg-white/20">Delete story</button>
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-center gap-2">
                  {STORY_REACTIONS.map(reaction => (
                    <button key={reaction} disabled={sendingAction} onClick={(e) => { e.stopPropagation(); sendReaction(reaction); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl transition hover:-translate-y-1 hover:bg-white/20 disabled:opacity-50">{reaction}</button>
                  ))}
                </div>
              )}

              {!isOwner && (
                <form onSubmit={sendReply} className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={'Reply to ' + currentStory.username + '...'} className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur" />
                  <button disabled={!replyText.trim() || sendingAction} className="rounded-full bg-white px-4 py-3 text-sm font-black text-neutral-950 disabled:opacity-40">Send</button>
                </form>
              )}

              {isOwner && showViewers && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl bg-black/50 p-3 backdrop-blur" onClick={e => e.stopPropagation()}>
                  {loadingViewers ? <p className="text-sm text-white/60">Loading...</p>
                    : viewers.length === 0 ? <p className="text-sm text-white/60">No views yet</p>
                    : viewers.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 py-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-black text-white">{v.viewerUsername?.[0]?.toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-bold text-white">{v.viewerUsername}</p>
                          <p className="text-xs text-white/50">{new Date(v.viewedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        story={confirmDeleteStory}
        deleting={Boolean(deletingStoryId)}
        onCancel={() => !deletingStoryId && setConfirmDeleteStory(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
