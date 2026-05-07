import React, { useEffect, useMemo, useState } from 'react';
import { postApi, resolveMediaUrl } from '../../api';
import PostCard from '../feed/PostCard';

const isVideo = (post) => /\.(mp4|webm|ogg|mov)$/i.test(resolveMediaUrl(post.mediaUrl || post.media || post.imageUrl || ''));

export default function Reels() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { postApi.getFeed().then(({ data }) => setPosts(Array.isArray(data) ? data.filter(p => !p.deleted) : [])).catch(() => setPosts([])).finally(() => setLoading(false)); }, []);
  const reels = useMemo(() => posts.filter(isVideo), [posts]);
  return (
    <main className="bg-black min-h-[calc(100vh-64px)] pb-20 text-white">
      <div className="max-w-md mx-auto">
        <div className="sticky top-16 z-20 bg-black/90 backdrop-blur h-14 px-4 flex items-center justify-between"><h1 className="text-2xl font-black">Reels</h1><span className="text-sm text-neutral-400">Vertical feed</span></div>
        {loading ? <p className="p-10 text-center text-neutral-400">Loading reels...</p> : reels.length === 0 ? <div className="p-10 text-center text-neutral-400"><p className="font-black text-white text-xl mb-1">No reels yet</p><p>Upload a video post and it will appear here.</p></div> : reels.map(post => <div key={post.postId} className="min-h-[calc(100vh-120px)] flex items-center"><div className="w-full bg-white text-neutral-950"><PostCard post={post} onDelete={() => setPosts(prev => prev.filter(p => p.postId !== post.postId))} /></div></div>)}
      </div>
    </main>
  );
}
