import React, { useEffect, useState, useRef, useCallback } from 'react';
import { mediaApi, followApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STORY_DURATION = 5000; // 5 seconds per story

export default function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories]             = useState([]);
  const [groupedStories, setGroupedStories] = useState([]); // [{userId, username, stories:[]}]
  const [viewingGroup, setViewingGroup]   = useState(null); // index in groupedStories
  const [currentIdx, setCurrentIdx]       = useState(0);   // index within group
  const [progress, setProgress]           = useState(0);   // 0-100
  const [paused, setPaused]               = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [viewers, setViewers]             = useState([]);
  const [showViewers, setShowViewers]     = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const fileRef   = useRef();
  const timerRef  = useRef(null);
  const startRef  = useRef(null);
  const elapsedRef = useRef(0);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

  /* ── Load stories ── */
  useEffect(() => {
    if (!user || user.role === 'GUEST') return;
    followApi.getFollowing(user.userId)
      .then(({ data: following }) => {
        const ids = [...following, parseInt(user.userId)];
        mediaApi.getStories(ids).then(({ data }) => {
          setStories(data);
          groupStories(data);
        }).catch(() => {});
      }).catch(() => {});
  }, [user]);

  /* Group stories by user */
  const groupStories = (allStories) => {
    const map = {};
    allStories.forEach(s => {
      if (!map[s.userId]) map[s.userId] = { userId: s.userId, username: s.username, stories: [] };
      map[s.userId].stories.push(s);
    });
    setGroupedStories(Object.values(map));
  };

  /* ── Progress timer ── */
  const startTimer = useCallback((remaining = STORY_DURATION) => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    elapsedRef.current = STORY_DURATION - remaining;
    const tick = 50;
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, tick);
  }, []);

  const stopTimer = () => {
    clearInterval(timerRef.current);
    elapsedRef.current += Date.now() - (startRef.current || Date.now());
  };

  /* ── Open a story group ── */
  const openGroup = async (groupIdx) => {
    setViewingGroup(groupIdx);
    setCurrentIdx(0);
    setProgress(0);
    setShowViewers(false);
    setViewers([]);
    elapsedRef.current = 0;
    const story = groupedStories[groupIdx]?.stories[0];
    if (story) await recordView(story);
  };

  /* ── Record view (only for other users' stories) ── */
  const recordView = async (story) => {
    if (!user || String(user.userId) === String(story.userId)) return;
    try {
      const { data: updated } = await mediaApi.incrementView(story.storyId, user.userId, user.username);
      setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, viewCount: updated.viewCount } : s));
      setGroupedStories(prev => prev.map(g => ({
        ...g,
        stories: g.stories.map(s => s.storyId === story.storyId ? { ...s, viewCount: updated.viewCount } : s)
      })));
    } catch {}
  };

  /* ── Navigate ── */
  const goNext = useCallback(async () => {
    if (viewingGroup === null) return;
    const group = groupedStories[viewingGroup];
    if (!group) return;
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
  }, [viewingGroup, currentIdx, groupedStories]);

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (viewingGroup > 0) {
      const prevGroup = viewingGroup - 1;
      setViewingGroup(prevGroup);
      setCurrentIdx(groupedStories[prevGroup].stories.length - 1);
      setProgress(0);
      elapsedRef.current = 0;
    }
  };

  const closeViewer = () => {
    clearInterval(timerRef.current);
    setViewingGroup(null);
    setCurrentIdx(0);
    setProgress(0);
    setShowViewers(false);
    elapsedRef.current = 0;
  };

  /* Start timer when story changes */
  useEffect(() => {
    if (viewingGroup === null) return;
    if (!paused) startTimer();
    return () => clearInterval(timerRef.current);
  }, [viewingGroup, currentIdx, paused]);

  /* ── Upload ── */
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { alert('Only JPEG, PNG, WebP, MP4 allowed.'); fileRef.current.value = ''; return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.userId);
      formData.append('username', user.username);
      const { data } = await mediaApi.createStory(formData);
      const updated = [data, ...stories];
      setStories(updated);
      groupStories(updated);
    } catch (err) {
      const msg = err.response?.data;
      alert(typeof msg === 'string' ? msg : msg?.message || 'Upload failed.');
    }
    setUploading(false);
    fileRef.current.value = '';
  };

  /* ── Delete ── */
  const handleDelete = async (storyId) => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await mediaApi.deleteStory(storyId);
      const updated = stories.filter(s => s.storyId !== storyId);
      setStories(updated);
      groupStories(updated);
      goNext();
    } catch {}
  };

  /* ── Viewers ── */
  const loadViewers = async (storyId) => {
    setLoadingViewers(true);
    try { const { data } = await mediaApi.getStoryViewers(storyId); setViewers(data); } catch {}
    setLoadingViewers(false);
    setShowViewers(true);
  };

  if (!user || user.role === 'GUEST') return null;

  const currentGroup   = viewingGroup !== null ? groupedStories[viewingGroup] : null;
  const currentStory   = currentGroup?.stories[currentIdx];
  const isOwner        = currentStory && String(currentStory.userId) === String(user.userId);

  return (
    <>
      {/* ── Stories Bar ── */}
      <div className="flex gap-4 overflow-x-auto p-4 card mb-4 items-center">
        {/* Add Story */}
        <div className="flex flex-col items-center flex-shrink-0">
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            className="w-16 h-16 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50">
            <span className="text-purple-400 text-2xl font-light">{uploading ? '…' : '+'}</span>
          </button>
          <span className="text-xs mt-1.5 text-gray-500 w-16 text-center truncate">Add Story</span>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4"
            className="hidden" onChange={handleUpload} />
        </div>

        {/* Story thumbnails grouped by user */}
        {groupedStories.map((group, gIdx) => (
          <div key={group.userId} onClick={() => openGroup(gIdx)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer">
            <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500 overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-100">
                {resolveMediaUrl(group.stories[0]?.mediaUrl)?.match(/\.(mp4|webm)$/i)
                  ? <video src={resolveMediaUrl(group.stories[0].mediaUrl)} className="w-full h-full object-cover" muted />
                  : <img src={resolveMediaUrl(group.stories[0].mediaUrl)} alt={group.username} className="w-full h-full object-cover" />}
              </div>
            </div>
            <span className="text-xs mt-1.5 text-gray-600 truncate w-16 text-center font-medium">{group.username}</span>
            <span className="text-xs text-purple-400">{group.stories.length} {group.stories.length === 1 ? 'story' : 'stories'}</span>
            {String(group.userId) === String(user.userId) && (
              <span className="text-xs text-gray-400">👁 {group.stories.reduce((sum, s) => sum + (s.viewCount || 0), 0)}</span>
            )}
          </div>
        ))}
      </div>

      {/* ── WhatsApp-style Story Viewer ── */}
      {currentStory && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onMouseDown={() => { setPaused(true); stopTimer(); }}
          onMouseUp={() => { setPaused(false); startTimer(STORY_DURATION - elapsedRef.current); }}
          onTouchStart={() => { setPaused(true); stopTimer(); }}
          onTouchEnd={() => { setPaused(false); startTimer(STORY_DURATION - elapsedRef.current); }}>

          <div className="relative w-full max-w-sm h-screen max-h-screen flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-none"
                    style={{ width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%' }} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-4 left-0 right-0 z-20 flex items-center gap-2 px-4 pt-4">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {currentStory.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{currentStory.username}</p>
                <p className="text-gray-300 text-xs">{new Date(currentStory.createdAt).toLocaleTimeString()}</p>
              </div>
              {isOwner && (
                <button onClick={() => handleDelete(currentStory.storyId)}
                  className="text-white text-xs bg-red-500 px-2 py-1 rounded-full mr-2">🗑️</button>
              )}
              <button onClick={closeViewer} className="text-white text-2xl leading-none">×</button>
            </div>

            {/* Media */}
            <div className="flex-1 flex items-center justify-center bg-black">
              {resolveMediaUrl(currentStory.mediaUrl)?.match(/\.(mp4|webm)$/i)
                ? <video key={currentStory.storyId} src={resolveMediaUrl(currentStory.mediaUrl)} autoPlay muted
                    className="w-full h-full object-contain max-h-screen" />
                : <img key={currentStory.storyId} src={resolveMediaUrl(currentStory.mediaUrl)} alt="story"
                    className="w-full h-full object-contain max-h-screen" />}
            </div>

            {/* Tap zones — left/right to navigate */}
            <div className="absolute inset-0 flex z-10 pointer-events-none">
              <div className="w-1/3 h-full pointer-events-auto" onClick={(e) => { e.stopPropagation(); goPrev(); }} />
              <div className="w-1/3 h-full" />
              <div className="w-1/3 h-full pointer-events-auto" onClick={(e) => { e.stopPropagation(); goNext(); }} />
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 bg-gradient-to-t from-black/60 to-transparent">
              {isOwner ? (
                <button onClick={(e) => { e.stopPropagation(); showViewers ? setShowViewers(false) : loadViewers(currentStory.storyId); }}
                  className="flex items-center gap-1.5 text-sm text-gray-200 hover:text-white">
                  👁 <span className="font-semibold">{currentStory.viewCount || 0}</span>
                  <span className="text-xs text-gray-400">{showViewers ? 'Hide' : 'See who viewed'}</span>
                </button>
              ) : null}

              {isOwner && showViewers && (
                <div className="mt-2 max-h-40 overflow-y-auto" onClick={e => e.stopPropagation()}>
                  {loadingViewers ? <p className="text-gray-400 text-sm">Loading…</p>
                    : viewers.length === 0 ? <p className="text-gray-400 text-sm">No views yet</p>
                    : viewers.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {v.viewerUsername?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm">{v.viewerUsername}</p>
                          <p className="text-gray-400 text-xs">{new Date(v.viewedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
