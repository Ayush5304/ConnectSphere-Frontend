import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchApi } from '../../api';

export default function SearchBar() {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState(null);
  const [trending, setTrending]     = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading]       = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  useEffect(() => {
    searchApi.getTrending().then(({ data }) => setTrending(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try { const { data } = await searchApi.search(q.trim()); setResults(data); }
    catch { setResults({ posts: [], users: [], hashtags: [] }); }
    setLoading(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val); setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) debounceRef.current = setTimeout(() => doSearch(val), 400);
    else setResults(null);
  };

  const hasResults = results && (results.posts?.length > 0 || results.users?.length > 0 || results.hashtags?.length > 0);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          className="w-full bg-gray-100 border border-transparent rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-100 placeholder-gray-500"
          placeholder="Search ConnectSphere..."
          value={query}
          onChange={handleChange}
          onFocus={() => setShowDropdown(true)}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-2xl mt-2 z-50 max-h-96 overflow-y-auto border border-gray-100">

          {loading && <p className="text-center text-gray-400 py-6 text-sm">Searching...</p>}

          {!loading && results && !hasResults && (
            <div className="p-6 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-gray-600 text-sm font-medium">No results for "{query}"</p>
              <p className="text-gray-400 text-xs mt-1">Try a different keyword or hashtag</p>
            </div>
          )}

          {!loading && results && hasResults && (
            <>
              {results.users?.length > 0 && (
                <div className="p-3">
                  <p className="section-label px-2 mb-2">People</p>
                  {results.users.slice(0, 4).map((u, i) => (
                    <Link key={u.userId || i} to={`/profile/${u.userId}`}
                      onClick={() => { setShowDropdown(false); setQuery(''); }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl">
                      <div className="avatar w-9 h-9 text-sm flex-shrink-0">
                        {u.profilePicture
                          ? <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                          : String(u.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{u.fullName || u.username}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.posts?.length > 0 && (
                <div className="p-3 border-t border-gray-50">
                  <p className="section-label px-2 mb-2">Posts</p>
                  {results.posts.slice(0, 4).map((p, i) => (
                    <div key={p.postId || i} className="px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer">
                      <p className="text-sm text-gray-800 truncate">{p.content}</p>
                      <p className="text-xs text-gray-400 mt-0.5">by @{p.username}</p>
                    </div>
                  ))}
                </div>
              )}

              {results.hashtags?.length > 0 && (
                <div className="p-3 border-t border-gray-50">
                  <p className="section-label px-2 mb-2">Hashtags</p>
                  {results.hashtags.map((h, i) => (
                    <div key={h.hashtagId || i}
                      onClick={() => { setQuery('#' + h.tag); doSearch('#' + h.tag); }}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer">
                      <span className="text-sm font-semibold text-violet-600">#{h.tag}</span>
                      <span className="text-xs text-gray-400">{h.postCount} posts</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !results && (
            <div className="p-3">
              <p className="section-label px-2 mb-2">🔥 Trending</p>
              {trending.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No trending hashtags yet</p>
              ) : trending.map((h, i) => (
                <div key={h.hashtagId || i}
                  onClick={() => { setQuery('#' + h.tag); doSearch(h.tag); setShowDropdown(true); }}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs font-bold w-4">{i+1}</span>
                    <span className="text-sm font-semibold text-violet-600">#{h.tag}</span>
                  </div>
                  <span className="text-xs text-gray-400">{h.postCount} posts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
