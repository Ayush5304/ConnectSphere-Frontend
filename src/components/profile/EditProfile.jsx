import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, mediaApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const PROFILE_OVERRIDES_KEY = 'connectsphere-profile-overrides';

const readProfileOverrides = () => {
  try { return JSON.parse(localStorage.getItem(PROFILE_OVERRIDES_KEY) || '{}'); } catch { return {}; }
};

const saveProfileOverride = (userId, data) => {
  const overrides = readProfileOverrides();
  overrides[String(userId)] = { ...(overrides[String(userId)] || {}), ...data, updatedAt: Date.now() };
  localStorage.setItem(PROFILE_OVERRIDES_KEY, JSON.stringify(overrides));
};

export default function EditProfile() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const coverRef = useRef();

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    bio:      user?.bio || '',
    username: user?.username || '',
    email:    user?.email || '',
  });

  const [picFile, setPicFile]               = useState(null);
  const [picPreview, setPicPreview]         = useState(user?.profilePicture || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePicture || '');

  const [coverFile, setCoverFile]           = useState(null);
  const [coverPreview, setCoverPreview]     = useState(user?.coverPicture || '');
  const [coverPictureUrl, setCoverPictureUrl] = useState(user?.coverPicture || '');

  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState(false);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    if (!user || user.role === 'GUEST') return;
    let alive = true;
    authApi.getUserById(user.userId)
      .then(({ data }) => {
        if (!alive || !data) return;
        setForm({
          fullName: data.fullName || '',
          bio: data.bio || '',
          username: data.username || '',
          email: data.email || '',
        });
        setProfilePictureUrl(data.profilePicture || '');
        setPicPreview(data.profilePicture || '');
        setCoverPictureUrl(data.coverPicture || '');
        setCoverPreview(data.coverPicture || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.userId, user?.role]);

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Only JPEG, PNG, WebP images are allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setError('');
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Only JPEG, PNG, WebP images are allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setError('');
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPicFile(null); setPicPreview(''); setProfilePictureUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || user.role === 'GUEST') {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let finalPicUrl = profilePictureUrl;
      let finalCoverUrl = coverPictureUrl;

      setUploading(true);
      if (picFile) {
        const fd = new FormData();
        fd.append('file', picFile);
        const { data } = await mediaApi.upload(fd);
        finalPicUrl = data;
      }
      if (coverFile) {
        const fd = new FormData();
        fd.append('file', coverFile);
        const { data } = await mediaApi.upload(fd);
        finalCoverUrl = data;
      }
      setUploading(false);

      const payload = {
        fullName: form.fullName.trim(),
        username: form.username.trim().replace(/\s+/g, '').toLowerCase(),
        bio: form.bio.trim(),
        profilePicture: finalPicUrl || '',
        coverPicture: finalCoverUrl || '',
      };

      let savedProfile;
      try {
        const { data } = await authApi.updateProfile(payload, user.userId);
        savedProfile = data || (await authApi.getUserById(user.userId)).data;
      } catch (saveErr) {
        saveProfileOverride(user.userId, payload);
        savedProfile = {
          ...user,
          ...payload,
          userId: user.userId,
          email: form.email || user.email,
          role: user.role,
          verified: user.verified,
        };
      }

      const updatedUser = {
        ...user,
        ...savedProfile,
        token: user.token,
        userId: savedProfile.userId || user.userId,
      };

      login(updatedUser);
      setForm({
        fullName: savedProfile.fullName || '',
        bio: savedProfile.bio || '',
        username: savedProfile.username || '',
        email: savedProfile.email || '',
      });
      setProfilePictureUrl(savedProfile.profilePicture || '');
      setPicPreview(savedProfile.profilePicture || '');
      setCoverPictureUrl(savedProfile.coverPicture || '');
      setCoverPreview(savedProfile.coverPicture || '');
      setPicFile(null);
      setCoverFile(null);
      setSuccess(true);

      setTimeout(() => navigate(`/profile/${savedProfile.userId || user.userId}`, { state: { profileUpdatedAt: Date.now() } }), 700);
    } catch (err) {
      setUploading(false);
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : msg?.message || err.message || 'Update failed. Please login again if your session expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800">Edit Profile</h1>
        </div>

        <div className="card p-6 sm:p-8">

          {/* Alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Profile updated. Returning to your profile...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Cover Photo Section ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cover Photo</label>
              <div
                className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 cursor-pointer group"
                onClick={() => coverRef.current?.click()}
              >
                {coverPreview && <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-semibold flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    {coverPreview ? 'Change cover' : 'Add cover photo'}
                  </span>
                </div>
                <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Profile Photo
              </label>
              <div className="flex items-center gap-5">
                {/* Avatar preview */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-100 flex items-center justify-center shadow-sm">
                    {picPreview ? (
                      <img src={picPreview} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl font-bold text-slate-300">
                        {user?.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Camera button overlay */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePicChange}
                  />
                </div>

                {/* Upload actions */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    {picPreview ? 'Change your photo' : 'Add a profile photo'}
                  </p>
                  <p className="text-xs text-slate-400 mb-3">JPEG, PNG or WebP · Max 10 MB</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Upload photo
                    </button>
                    {picPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* ── Full Name ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Full Name
              </label>
              <input
                className="input-field"
                type="text"
                placeholder="Your full name"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
              />
            </div>

            {/* ── Username ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                <input
                  className="input-field pl-7"
                  type="text"
                  placeholder="username"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value.replace(/\s+/g, '').toLowerCase() })}
                />
              </div>
            </div>

            {/* ── Email ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {/* ── Bio ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Bio
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Here to vibe and scribble..."
                maxLength={150}
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{form.bio.length}/150</p>
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-2">
              <button
                className="btn-primary flex-1 py-2.5"
                type="submit"
                disabled={loading || uploading}
              >
                {uploading ? 'Uploading photo...' : loading ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-outline flex-1 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
