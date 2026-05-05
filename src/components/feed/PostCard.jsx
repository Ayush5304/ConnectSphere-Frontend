import React, { useState, useEffect, useRef } from 'react';
import { commentApi, likeApi, postApi, mediaApi, searchApi, resolveMediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const REACTIONS = ['LIKE','LOVE','HAHA','WOW','SAD','ANGRY'];
const EMOJI = { LIKE:'👍', LOVE:'❤️', HAHA:'😂', WOW:'😮', SAD:'😢', ANGRY:'😡' };
const REACTION_LABEL = { LIKE:'Like', LOVE:'Love', HAHA:'Haha', WOW:'Wow', SAD:'Sad', ANGRY:'Angry' };
const REACTION_COLOR = { LIKE:'text-blue-600', LOVE:'text-red-500', HAHA:'text-yellow-500', WOW:'text-yellow-500', SAD:'text-yellow-500', ANGRY:'text-orange-500' };

const VIS = {
  PUBLIC:    { icon: 'Public', label: 'Public' },
  FOLLOWERS: { icon: 'Followers', label: 'Followers' },
  PRIVATE:   { icon: 'Private', label: 'Only me' },
};

function renderContent(text, onHashtagClick) {
  if (!text) return null;
  return text.split(/(\s+)/).map((word, i) => {
    if (typeof word !== 'string') return null;
    if (word.startsWith('#') && word.length > 1) return <span key={i} className="text-violet-600 font-medium hover:underline cursor-pointer" onClick={() => onHashtagClick && onHashtagClick(word.slice(1))}>{word}</span>;
    if (word.startsWith('@') && word.length > 1) return <span key={i} className="text-pink-500 font-medium hover:underline cursor-pointer">{word}</span>;
    return word;
  });
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds/86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGuest  = !user || user.role === 'GUEST';
  const isOwner  = user && String(user.userId) === String(post.userId);
  const isAdmin  = user?.role === 'ADMIN';

  const [showReactions, setShowReactions]     = useState(false);
  const [likesCount, setLikesCount]           = useState(post.likesCount || 0);
  const [reactionSummary, setReactionSummary] = useState({});
  const [userReaction, setUserReaction]       = useState(null);
  const [showComments, setShowComments]       = useState(false);
  const [comments, setComments]               = useState([]);
  const [newComment, setNewComment]           = useState('');
  const [commentsCount, setCommentsCount]     = useState(post.commentsCount || 0);
  const [editing, setEditing]                 = useState(false);
  const [editContent, setEditContent]         = useState(post.content || '');
  const [editMediaUrl, setEditMediaUrl]       = useState(post.mediaUrl || '');
  const [editMediaFile, setEditMediaFile]     = useState(null);
  const [editMediaPreview, setEditMediaPreview] = useState(post.mediaUrl || '');
  const [replyingTo, setReplyingTo]           = useState(null);
  const [replies, setReplies]                 = useState({});
  const [replyText, setReplyText]             = useState('');
  const [showReport, setShowReport]           = useState(false);
  const [reportReason, setReportReason]       = useState('');
  const [reported, setReported]               = useState(false);
  const [showOptions, setShowOptions]         = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentLikes, setCommentLikes]       = useState({});
  const [hashtagModal, setHashtagModal]       = useState(null);
  const [hashtagPosts, setHashtagPosts]       = useState([]);
  const [hashtagLoading, setHashtagLoading]   = useState(false);
  const editFileRef = useRef();
  const optionsRef  = useRef();

  useEffect(() => {
    likeApi.getReactionSummary(post.postId, 'POST')
      .then(({ data }) => {
        setReactionSummary(data);
        setLikesCount(Object.values(data).reduce((a, b) => a + b, 0));
      }).catch(() => {});
    if (!isGuest) {
      likeApi.getUserReaction(user.userId, post.postId, 'POST')
        .then(({ data }) => setUserReaction(data?.reactionType || null)).catch(() => {});
    }
  }, [post.postId]);

  useEffect(() => {
    const h = (e) => { if (optionsRef.current && !optionsRef.current.contains(e.target)) setShowOptions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleUnreact = async () => {
    if (isGuest) { navigate('/login'); return; }
    try {
      await likeApi.unreact(user.userId, post.postId, 'POST');
      setReactionSummary(prev => {
        const u = { ...prev };
        if (userReaction && u[userReaction]) {
          u[userReaction] = Math.max(0, u[userReaction] - 1);
          if (u[userReaction] === 0) delete u[userReaction];
        }
        return u;
      });
      setLikesCount(c => Math.max(0, c - 1));
      setUserReaction(null);
    } catch {}
    setShowReactions(false);
  };

  const handleReact = async (reaction) => {
    if (isGuest) { navigate('/login'); return; }
    try {
      await likeApi.react({ userId: user.userId, targetId: post.postId, targetType: 'POST', reactionType: reaction });
      if (!userReaction) setLikesCount(c => c + 1);
      setReactionSummary(prev => {
        const u = { ...prev };
        if (userReaction && u[userReaction]) u[userReaction] = Math.max(0, u[userReaction] - 1);
        u[reaction] = (u[reaction] || 0) + 1;
        return u;
      });
      setUserReaction(reaction);
    } catch {}
    setShowReactions(false);
  };

  const loadComments = async () => {
    if (!showComments) {
      try {
        const { data } = await commentApi.getByPost(post.postId);
        setComments(data);
        loadCommentLikes(data);
      } catch {}
    }
    setShowComments(prev => !prev);
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (isGuest) { navigate('/login'); return; }
    if (!newComment.trim()) return;
    try {
      const { data } = await commentApi.add({ postId: post.postId, userId: user.userId, username: user.username, content: newComment });
      setComments(prev => [...prev, data]);
      setCommentsCount(c => c + 1);
      setNewComment('');
    } catch {}
  };

  const handleEdit = async () => {
    try {
      let mediaUrl = editMediaUrl;
      if (editMediaFile) {
        const formData = new FormData();
        formData.append('file', editMediaFile);
        const { data: url } = await mediaApi.upload(formData);
        mediaUrl = url;
      }
      await postApi.edit(post.postId, { content: editContent, mediaUrl });
      post.content = editContent; post.mediaUrl = mediaUrl;
      setEditMediaUrl(mediaUrl); setEditMediaPreview(mediaUrl);
      setEditMediaFile(null); setEditing(false);
    } catch {}
  };

  const loadReplies = async (commentId) => {
    if (replies[commentId]) return;
    try { const { data } = await commentApi.getReplies(commentId); setReplies(prev => ({ ...prev, [commentId]: data })); } catch {}
  };

  const handleReply = async (parentCommentId) => {
    if (isGuest) { navigate('/login'); return; }
    if (!replyText.trim()) return;
    try {
      const { data } = await commentApi.add({ postId: post.postId, userId: user.userId, username: user.username, content: replyText, parentCommentId: String(parentCommentId) });
      setReplies(prev => ({ ...prev, [parentCommentId]: [...(prev[parentCommentId] || []), data] }));
      setReplyText(''); setReplyingTo(null);
    } catch {}
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try { await postApi.report(post.postId, reportReason); setReported(true); setShowReport(false); } catch {}
  };

  const handleEditComment = async (commentId) => {
    if (!editingCommentText.trim()) return;
    try {
      const { data } = await commentApi.edit(commentId, editingCommentText);
      setComments(prev => prev.map(c => c.commentId === commentId ? { ...c, content: data.content } : c));
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch {}
  };

  const handleCommentLike = async (commentId) => {
    if (isGuest) { navigate('/login'); return; }
    const existing = commentLikes[commentId];
    try {
      if (existing) {
        await likeApi.unreact(user.userId, commentId, 'COMMENT');
        setCommentLikes(prev => { const u = { ...prev }; delete u[commentId]; return u; });
      } else {
        await likeApi.react({ userId: user.userId, targetId: commentId, targetType: 'COMMENT', reactionType: 'LIKE' });
        setCommentLikes(prev => ({ ...prev, [commentId]: true }));
      }
    } catch {}
  };

  const loadCommentLikes = async (commentsList) => {
    if (isGuest || !commentsList.length) return;
    const results = await Promise.all(
      commentsList.map(c =>
        likeApi.getUserReaction(user.userId, c.commentId, 'COMMENT')
          .then(({ data }) => ({ id: c.commentId, liked: !!data?.reactionType }))
          .catch(() => ({ id: c.commentId, liked: false }))
      )
    );
    const map = {};
    results.forEach(r => { if (r.liked) map[r.id] = true; });
    setCommentLikes(map);
  };

  const openHashtag = async (tag) => {
    setHashtagModal(tag);
    setHashtagLoading(true);
    setHashtagPosts([]);
    try {
      const { data } = await searchApi.search('#' + tag);
      setHashtagPosts(data.posts || []);
    } catch {}
    setHashtagLoading(false);
  };

  const vis = VIS[post.visibility] || VIS.PUBLIC;
  const postMediaUrl = resolveMediaUrl(post.mediaUrl);

  return (
    <article className="card cinema-card-hover mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to={`/profile/${post.userId}`} className="flex-shrink-0">
          <div className="avatar w-10 h-10 text-sm">
            {post.username?.[0]?.toUpperCase()}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${post.userId}`} className="font-bold text-neutral-950 hover:underline text-sm">
            {post.username}
          </Link>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-neutral-500">{timeAgo(post.createdAt)}</span>
            <span className="text-neutral-300">·</span>
            <span className="text-xs text-neutral-500" title={vis.label}>{vis.icon}</span>
          </div>
        </div>

        {/* Options menu */}
        <div className="relative flex-shrink-0" ref={optionsRef}>
          <button onClick={() => setShowOptions(v => !v)}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 text-lg font-bold">
            ···
          </button>
          {showOptions && (
            <div className="dropdown absolute right-0 top-9 w-44 z-20 py-1 overflow-hidden">
              {isOwner && (
                <>
                  <button onClick={() => { setEditing(true); setShowOptions(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50">
                    Edit post
                  </button>
                  <button onClick={() => { onDelete(post.postId); setShowOptions(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                    Delete post
                  </button>
                </>
              )}
              {isAdmin && !isOwner && (
                <button onClick={() => { onDelete(post.postId); setShowOptions(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                  Remove post
                </button>
              )}
              {!isOwner && !isAdmin && !isGuest && !reported && (
                <button onClick={() => { setShowReport(true); setShowOptions(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50">
                  Report post
                </button>
              )}
              {reported && (
                <div className="px-4 py-2.5 text-sm text-green-600">Reported</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="px-4 pb-3 space-y-2">
          <textarea className="input-field resize-none text-sm" rows={3}
            value={editContent} onChange={e => setEditContent(e.target.value)} />
          {editMediaPreview && (
            <div className="relative inline-block">
              <img src={resolveMediaUrl(editMediaPreview)} alt="media" className="rounded-lg max-h-40 object-cover" />
              <button onClick={() => { setEditMediaPreview(''); setEditMediaUrl(''); setEditMediaFile(null); }}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">x</button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => editFileRef.current.click()}
              className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-bold">
              Change media
            </button>
            <input ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden"
              onChange={e => { const f = e.target.files[0]; if (!f) return; setEditMediaFile(f); setEditMediaPreview(URL.createObjectURL(f)); }} />
            <button onClick={handleEdit} className="btn-primary text-xs py-1.5 px-4">Save</button>
            <button onClick={() => { setEditing(false); setEditMediaFile(null); setEditMediaPreview(post.mediaUrl || ''); }}
              className="btn-outline text-xs py-1.5 px-4">Cancel</button>
          </div>
        </div>
      ) : (
        post.content && (
          <div className="px-4 pb-3">
            <p className="text-neutral-900 text-sm leading-relaxed">{renderContent(post.content, openHashtag)}</p>
          </div>
        )
      )}

      {/* Media */}
      {!editing && postMediaUrl && (
        <div className="w-full bg-black">
          {postMediaUrl.match(/\.(mp4|webm|ogg)$/i)
            ? <video src={postMediaUrl} className="w-full max-h-[680px] object-contain" controls />
            : <img src={postMediaUrl} alt="post" className="w-full max-h-[680px] object-contain" />}
        </div>
      )}

      {/* Reaction summary + counts */}
      {(likesCount > 0 || commentsCount > 0) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100">
          <div className="flex items-center gap-1">
            {Object.keys(reactionSummary).length > 0 && (
              <div className="flex items-center gap-1">
                {Object.entries(reactionSummary).slice(0, 3).map(([type, count]) => (
                  <span key={type} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600">
                    {EMOJI[type]} {REACTION_LABEL[type]} {count}
                  </span>
                ))}
              </div>
            )}
            {likesCount > 0 && <span className="text-xs text-neutral-500 ml-1">{likesCount}</span>}
          </div>
          {commentsCount > 0 && (
            <button onClick={loadComments} className="text-xs text-neutral-500 hover:underline">
              {commentsCount} comment{commentsCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center px-2 py-1 border-b border-neutral-100">
        {/* Like */}
        <div className="relative flex-1">
          <button
            onMouseEnter={() => !isGuest && setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
            onClick={() => isGuest ? navigate('/login') : (userReaction ? handleUnreact() : handleReact('LIKE'))}
            className={`post-action w-full ${userReaction ? REACTION_COLOR[userReaction] + ' font-semibold' : ''}`}>
            <span className="inline-flex items-center justify-center gap-1">{userReaction ? <><span className="text-lg leading-none">{EMOJI[userReaction]}</span><span>{REACTION_LABEL[userReaction]}</span></> : 'Like'}</span>
          </button>
          {showReactions && !isGuest && (
            <div className="dropdown absolute bottom-10 left-0 flex gap-1 px-2 py-2 z-20"
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}>
              {REACTIONS.map(r => (
                <button key={r} onClick={() => handleReact(r)}
                  className="group flex flex-col items-center gap-0.5 rounded-full px-2 py-1 transition hover:-translate-y-1 hover:bg-white hover:shadow-lg" title={REACTION_LABEL[r]}>
                  <span className="text-2xl leading-none">{EMOJI[r]}</span>
                  <span className="text-[10px] font-bold text-neutral-500">{REACTION_LABEL[r]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment */}
        <button onClick={loadComments} className="post-action flex-1">
          Comment
        </button>
      </div>

      {/* Report form */}
      {showReport && (
        <div className="mx-4 my-3 p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-xs font-semibold text-red-700 mb-2">Why are you reporting this post?</p>
          <input className="input-field text-sm mb-2" placeholder="Describe the issue..."
            value={reportReason} onChange={e => setReportReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleReport} className="text-xs bg-red-500 text-white px-4 py-1.5 rounded-lg hover:bg-red-600 font-medium">Submit</button>
            <button onClick={() => { setShowReport(false); setReportReason(''); }} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="px-4 py-3 space-y-3">
          {/* Comment input */}
          {isGuest ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-500">Want to comment?</span>
              <Link to="/login" className="text-sm text-violet-600 font-semibold hover:underline">Log in</Link>
              <span className="text-sm text-gray-400">or</span>
              <Link to="/register" className="text-sm text-violet-600 font-semibold hover:underline">Sign up</Link>
            </div>
          ) : (
            <form onSubmit={handleComment} className="flex gap-2 items-center">
              <div className="avatar w-8 h-8 text-xs flex-shrink-0">
                {user.profilePicture
                  ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                  : user.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 relative">
                <input className="input-field py-2 text-sm pr-12"
                  placeholder="Write a comment..."
                  value={newComment} onChange={e => setNewComment(e.target.value)} />
                <button type="submit" disabled={!newComment.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-violet-600 disabled:text-gray-300 font-semibold text-sm">
                  Post
                </button>
              </div>
            </form>
          )}

          {/* Comments list */}
          {comments.map(c => (
            <div key={c.commentId}>
              <div className="flex gap-2">
                <div className="avatar w-8 h-8 text-xs flex-shrink-0">{c.username?.[0]?.toUpperCase()}</div>
                <div className="flex-1">
                  {editingCommentId === c.commentId ? (
                    <div className="flex gap-2 items-center">
                      <input className="input-field py-1.5 text-sm flex-1"
                        value={editingCommentText}
                        onChange={e => setEditingCommentText(e.target.value)}
                        autoFocus />
                      <button onClick={() => handleEditComment(c.commentId)}
                        className="text-xs text-violet-600 font-semibold hover:text-violet-800">Save</button>
                      <button onClick={() => setEditingCommentId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full">
                      <p className="font-semibold text-gray-900 text-xs">{c.username}</p>
                      <p className="text-gray-700 text-sm mt-0.5">{renderContent(c.content, openHashtag)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 ml-2">
                    <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                    {!isGuest && (
                      <button onClick={() => handleCommentLike(c.commentId)}
                        className={`text-xs font-semibold inline-flex items-center gap-1 ${commentLikes[c.commentId] ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>
                        <span>{commentLikes[c.commentId] ? '👍' : ''}</span><span>Like</span>
                      </button>
                    )}
                    {!isGuest && (
                      <button onClick={() => { loadReplies(c.commentId); setReplyingTo(replyingTo === c.commentId ? null : c.commentId); setReplyText(''); }}
                        className="text-xs text-gray-500 font-semibold hover:text-violet-600">Reply</button>
                    )}
                    {user && String(user.userId) === String(c.userId) && (
                      <button onClick={() => { setEditingCommentId(c.commentId); setEditingCommentText(c.content); }}
                        className="text-xs text-gray-500 hover:text-violet-600">Edit</button>
                    )}
                    {!isGuest && user && String(user.userId) !== String(c.userId) && (
                      <button onClick={async () => {
                        const reason = window.prompt('Why are you reporting this comment?');
                        if (reason?.trim()) await commentApi.report(c.commentId, reason.trim()).catch(() => {});
                      }} className="text-xs text-gray-400 hover:text-red-500">Report</button>
                    )}
                    {(user && String(user.userId) === String(c.userId) || isAdmin) && (
                      <button onClick={async () => {
                        await commentApi.delete(c.commentId).catch(() => {});
                        setComments(prev => prev.filter(x => x.commentId !== c.commentId));
                        setCommentsCount(n => Math.max(0, n - 1));
                      }} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Replies */}
              {(replies[c.commentId]?.length > 0 || replyingTo === c.commentId) && (
                <div className="ml-10 mt-2 space-y-2">
                  {(replies[c.commentId] || []).map(r => (
                    <div key={r.commentId} className="flex gap-2">
                      <div className="avatar w-7 h-7 text-xs flex-shrink-0">{r.username?.[0]?.toUpperCase()}</div>
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block">
                          <p className="font-semibold text-gray-900 text-xs">{r.username}</p>
                          <p className="text-gray-700 text-xs mt-0.5">{renderContent(r.content)}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-2">
                          <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                          {(user && String(user.userId) === String(r.userId) || isAdmin) && (
                            <button onClick={async () => {
                              await commentApi.delete(r.commentId).catch(() => {});
                              setReplies(prev => ({ ...prev, [c.commentId]: prev[c.commentId].filter(x => x.commentId !== r.commentId) }));
                            }} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {replyingTo === c.commentId && (
                    <form onSubmit={e => { e.preventDefault(); handleReply(c.commentId); }} className="flex gap-2 items-center">
                      <div className="avatar w-7 h-7 text-xs flex-shrink-0">
                        {user?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 relative">
                        <input className="input-field py-1.5 text-xs pr-12"
                          placeholder={`Reply to ${c.username}...`}
                          value={replyText} onChange={e => setReplyText(e.target.value)} autoFocus />
                        <button type="submit" disabled={!replyText.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-violet-600 disabled:text-gray-300 font-semibold text-xs">
                          Reply
                        </button>
                      </div>
                      <button type="button" onClick={() => setReplyingTo(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Hashtag Modal */}
      {hashtagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setHashtagModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">#{hashtagModal}</h3>
              <button onClick={() => setHashtagModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {hashtagLoading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : hashtagPosts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No posts found for #{hashtagModal}</p>
              ) : (
                hashtagPosts.map((p, i) => (
                  <div key={p.postId || i} className="border border-gray-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">@{p.username}</p>
                    <p className="text-sm text-gray-800">{p.content}</p>
                    {p.mediaUrl && <img src={resolveMediaUrl(p.mediaUrl)} alt="" className="mt-2 rounded-lg max-h-40 object-cover w-full" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
