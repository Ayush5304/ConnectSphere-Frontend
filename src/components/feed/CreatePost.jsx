import React, { useState, useRef } from 'react';
import { postApi, mediaApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

const VIS_OPTIONS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'FOLLOWERS', label: 'Followers' },
  { value: 'PRIVATE', label: 'Only me' },
];

export default function CreatePost({ onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const textRef = useRef();

  const firstName = user?.fullName?.split(' ')[0] || user?.username || 'there';

  const handleFileChange = (event) => {
    const file = event.target.files[0];
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

  const closeComposer = () => {
    setExpanded(false);
    setContent('');
    removeMedia();
    setError('');
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile) return;
    setLoading(true);
    setError('');
    try {
      let mediaUrl = null;
      if (mediaFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', mediaFile);
        const { data: url } = await mediaApi.upload(formData);
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
      closeComposer();
    } catch (err) {
      setUploading(false);
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card cinema-card-hover mb-4 overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="avatar w-11 h-11 text-sm">
            {user?.profilePicture
              ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
              : user?.username?.[0]?.toUpperCase()}
          </div>
          <button
            type="button"
            onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex-1 min-h-[44px] text-left bg-neutral-100 hover:bg-neutral-200/70 rounded-full px-4 text-sm text-neutral-500 transition-colors"
          >
            Share a photo or thought, {firstName}
          </button>
        </div>

        {expanded && (
          <div className="pt-4">
            {error && (
              <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <textarea
              ref={textRef}
              className="w-full bg-transparent border-0 outline-none text-neutral-900 text-base resize-none placeholder-neutral-400 min-h-[94px] leading-relaxed"
              placeholder="Write a caption..."
              value={content}
              onChange={event => setContent(event.target.value)}
              rows={3}
              autoFocus
            />

            {mediaPreview && (
              <div className="relative mt-3 rounded-lg overflow-hidden bg-black">
                {mediaFile?.type.startsWith('video')
                  ? <video src={mediaPreview} className="w-full max-h-[420px] object-contain" controls />
                  : <img src={mediaPreview} alt="preview" className="w-full max-h-[420px] object-contain" />}
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-3 right-3 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black"
                  aria-label="Remove media"
                >
                  x
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-outline h-9 px-3 text-xs"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  Media
                </button>
                <div className="flex items-center bg-neutral-100 rounded-lg p-1">
                  {VIS_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className={`text-xs px-3 h-8 rounded-md font-bold transition-colors ${
                        visibility === opt.value ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={closeComposer} className="btn-outline h-9 px-4 text-xs">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || uploading || (!content.trim() && !mediaFile)}
                  className="btn-primary h-9 px-5 text-xs"
                >
                  {uploading ? 'Uploading...' : loading ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!expanded && (
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => { setExpanded(true); setTimeout(() => fileRef.current?.click(), 100); }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-neutral-100 text-sm font-bold text-neutral-600"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Photo / Video
            </button>
            <button
              type="button"
              onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-neutral-100 text-sm font-bold text-neutral-600"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Caption
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
