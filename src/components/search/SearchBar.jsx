import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchApi } from '../../api';

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [trending, setTrending] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    searchApi.getTrending().then(({ data }) => setTrending(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const doSearch = async (value) => {
    if (!value.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchApi.search(value.trim());
      setResults(data);
    } catch {
      setResults({ posts: [], users: [], hashtags: [] });
    }
    setLoading(false);
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) debounceRef.current = setTimeout(() => doSearch(value), 350);
    else setResults(null);
  };

  const hasResults = results && (results.posts?.length > 0 || results.users?.length > 0 || results.hashtags?.length > 0);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
          <SearchIcon />
        </span>
        <input
          className="w-full h-10 bg-neutral-100 border border-transparent rounded-lg pl-10 pr-9 text-sm text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-300 focus:ring-2 focus:ring-blue-100 placeholder-neutral-500"
          placeholder="Search"
          value={query}
          onChange={handleChange}
          onFocus={() => setShowDropdown(true)}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-lg leading-none"
            aria-label="Clear search"
          >
            x
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="dropdown absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto">
          {loading && <p className="text-center text-neutral-400 py-6 text-sm">Searching...</p>}

          {!loading && results && !hasResults && (
            <div className="p-7 text-center">
              <p className="text-sm font-bold text-neutral-700">No results for "{query}"</p>
              <p className="text-xs text-neutral-400 mt-1">Try a name, post, or hashtag.</p>
            </div>
          )}

          {!loading && results && hasResults && (
            <>
              {results.users?.length > 0 && (
                <div className="p-3">
                  <p className="section-label px-2 mb-2">People</p>
                  {results.users.slice(0, 4).map((u, i) => (
                    <Link
                      key={u.userId || i}
                      to={`/profile/${u.userId}`}
                      onClick={() => { setShowDropdown(false); setQuery(''); }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 rounded-lg"
                    >
                      <div className="avatar w-9 h-9 text-sm">
                        {u.profilePicture
                          ? <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                          : String(u.username || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{u.fullName || u.username}</p>
                        <p className="text-xs text-neutral-500 truncate">@{u.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.posts?.length > 0 && (
                <div className="p-3 border-t border-neutral-100">
                  <p className="section-label px-2 mb-2">Posts</p>
                  {results.posts.slice(0, 4).map((p, i) => (
                    <div key={p.postId || i} className="px-3 py-2.5 hover:bg-neutral-50 rounded-lg cursor-pointer">
                      <p className="text-sm text-neutral-900 truncate">{p.content}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">by @{p.username}</p>
                    </div>
                  ))}
                </div>
              )}

              {results.hashtags?.length > 0 && (
                <div className="p-3 border-t border-neutral-100">
                  <p className="section-label px-2 mb-2">Hashtags</p>
                  {results.hashtags.map((h, i) => (
                    <button
                      type="button"
                      key={h.hashtagId || i}
                      onClick={() => { setQuery(`#${h.tag}`); doSearch(`#${h.tag}`); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 rounded-lg"
                    >
                      <span className="text-sm font-bold text-blue-500">#{h.tag}</span>
                      <span className="text-xs text-neutral-500">{h.postCount} posts</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !results && (
            <div className="p-3">
              <p className="section-label px-2 mb-2">Trending</p>
              {trending.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-5">No trending hashtags yet</p>
              ) : trending.map((h, i) => (
                <button
                  type="button"
                  key={h.hashtagId || i}
                  onClick={() => { setQuery(`#${h.tag}`); doSearch(`#${h.tag}`); setShowDropdown(true); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-black text-neutral-400 w-4">{i + 1}</span>
                    <span className="text-sm font-bold text-blue-500">#{h.tag}</span>
                  </span>
                  <span className="text-xs text-neutral-500">{h.postCount} posts</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
