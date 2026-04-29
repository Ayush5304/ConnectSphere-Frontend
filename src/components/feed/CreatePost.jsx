import React, { useState, useRef } from 'react';
import { postApi, mediaApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

const VIS_OPTIONS = [
  { value: 'PUBLIC',    icon: '🌍', label: 'Public' },
  { value: 'FOLLOWERS', icon: '👥', label: 'Followers' },
  { value: 'PRIVATE',   icon: '🔒', label: 'Only me' },
];

export default function CreatePost({ onCreated }) {
  const { user } = useAuth();
  const [content, setContent]         = useState('');
  const [visibility, setVisibility]   = useState('PUBLIC');
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [mediaFile, setMediaFile]     = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [expanded, setExpanded]       = useState(false);
  const [error, setError]             = useState('');
  const fileRef = useRef();
  const textRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP images and MP4 videos are allowed.');
      return;
    }
    const limit = file.type.startsWith('video') ? MAX_VIDEO : MAX_IMAGE;
    if (file.size > limit) {
      setError(`File too large. Max ${limit / 1048576}MB.`);
      return;
    }
    setError('');
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setExpanded(true);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile) return;
    setLoading(true);
    setError('');
    try {
      let mediaUrl = null;
      if (mediaFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', mediaFile);
        const { data: url } = await mediaApi.upload(fd);
        mediaUrl = url;
        setUploading(false);
      }
      const { data } = await postApi.create({
        userId: user.userId,
        username: user.username,
        content,
        visibility,
        mediaUrl,
      });
      onCreated(data);
      setContent('');
      setMediaFile(null);
      setMediaPreview(null);
      setExpanded(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploading(false);
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-4 p-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top row */}
      <div className="flex items-center gap-3">
        <div className="avatar w-10 h-10 text-sm flex-shrink-0">
          {user?.profilePicture
            ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
            : user?.username?.[0]?.toUpperCase()}
        </div>
        <button
          onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
          className="flex-1 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-sm text-slate-400 transition-colors"
        >
          What's on your mind, {user?.fullName?.split(' ')[0] || user?.username}?
        </button>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="mt-3">
          {error && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <textarea
            ref={textRef}
            className="w-full bg-transparent border-none outline-none text-slate-800 text-sm resize-none placeholder-slate-400 min-h-[80px] leading-relaxed"
            placeholder={`What's on your mind, ${user?.fullName?.split(' ')[0] || user?.username}?`}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            autoFocus
          />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden bg-slate-900">
              {mediaFile?.type.startsWith('video')
                ? <video src={mediaPreview} className="w-full max-h-64 object-contain" controls />
                : <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-contain" />}
              <button
                onClick={removeMedia}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/80 text-sm transition-colors"
              >×</button>
            </div>
          )}

          <div className="border-t border-slate-100 mt-3 pt-3 flex items-center justify-between gap-2 flex-wrap">
            {/* Left: visibility + photo */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 rounded-full p-0.5">
                {VIS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setVisibility(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                      visibility === opt.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Photo/Video
              </button>
            </div>

            {/* Right: cancel + post */}
            <div className="flex gap-2">
              <button
                onClick={() => { setExpanded(false); setContent(''); removeMedia(); setError(''); }}
                className="btn-outline text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || uploading || (!content.trim() && !mediaFile)}
                className="btn-primary text-xs py-2 px-5"
              >
                {uploading ? 'Uploading…' : loading ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed quick actions */}
      {!expanded && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => { setExpanded(true); setTimeout(() => fileRef.current?.click(), 100); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-500 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span className="hidden sm:inline">Photo / Video</span>
          </button>
          <button
            onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-500 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            <span className="hidden sm:inline">Feeling</span>
          </button>
          <button
            onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-500 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="hidden sm:inline">Location</span>
          </button>
        </div>
      )}
    </div>
  );
}
