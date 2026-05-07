import React, { useEffect, useMemo, useState } from 'react';
import { postApi, resolveMediaUrl } from '../../api';
import { useNavigate } from 'react-router-dom';

export default function Explore() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    postApi.getFeed().then(({ data }) => setPosts(Array.isArray(data) ? data.filter(p => !p.deleted) : [])).catch(() => setPosts([])).finally(() => setLoading(false));
  }, []);
  const visible = useMemo(() => posts.filter(p => !query || String(p.content || '').toLowerCase().includes(query.toLowerCase()) || String(p.username || '').toLowerCase().includes(query.toLowerCase())), [posts, query]);
  return (
    <main className="max-w-4xl mx-auto bg-white min-h-[calc(100vh-64px)] pb-20">
      <div className="sticky top-16 z-20 bg-white border-b border-neutral-200 p-3"><input value={query} onChange={e => setQuery(e.target.value)} className="w-full h-12 rounded-xl bg-neutral-100 px-4 outline-none" placeholder="Search ConnectSphere" /></div>
      {loading ? <p className="p-10 text-center text-neutral-500">Loading explore...</p> : visible.length === 0 ? <p className="p-10 text-center text-neutral-500">No posts found.</p> : (
        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:p-1">
          {visible.map((post, index) => {
            const media = resolveMediaUrl(post.mediaUrl || post.media || post.imageUrl || '');
            return <button key={post.postId || index} onClick={() => navigate('/profile/' + post.userId + '?post=' + post.postId)} className={(index % 7 === 0 ? 'row-span-2 ' : '') + 'relative aspect-square bg-neutral-100 overflow-hidden'}>{media ? (media.match(/\.(mp4|webm|ogg)$/i) ? <video src={media} className="w-full h-full object-cover" muted /> : <img src={media} alt="" className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs font-bold">{post.content || 'Post'}</div>}<span className="absolute left-2 bottom-2 text-white text-xs font-black drop-shadow">{post.likesCount || 0}</span></button>;
          })}
        </div>
      )}
    </main>
  );
}
