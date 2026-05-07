/*
 * api/index.js - Central API Communication File
 *
 * This file contains ALL the API calls made from the frontend to the backend.
 * Every request goes through the API Gateway at localhost:8080.
 * The gateway then routes the request to the correct microservice.
 *
 * Why one file for all APIs?
 *   - Easy to manage - all endpoints in one place
 *   - If the base URL changes, we only update it here
 *   - Clean separation - components don't need to know about URLs
 *
 * We use AXIOS library to make HTTP requests (GET, POST, PUT, DELETE)
 *
 * Two types of requests:
 *   1. Public requests  - no token needed (login, register, view feed)
 *   2. Private requests - need JWT token in Authorization header
 */

import axios from 'axios';

/*
 * API - Base URL for all requests
 * All requests go to the API Gateway first (port 8080)
 * Gateway then forwards to the correct microservice
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';
export const OAUTH_GOOGLE_URL = process.env.REACT_APP_OAUTH_GOOGLE_URL || 'http://localhost:8080/oauth2/authorization/google';
const API = API_BASE_URL;
const GATEWAY_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const SERVICE_FALLBACKS = [
  { gateway: `${GATEWAY_ORIGIN}/api/auth`, service: 'http://localhost:8081/auth' },
  { gateway: `${GATEWAY_ORIGIN}/api/posts`, service: 'http://localhost:8082/posts' },
  { gateway: `${GATEWAY_ORIGIN}/api/comments`, service: 'http://localhost:8083/comments' },
  { gateway: `${GATEWAY_ORIGIN}/api/likes`, service: 'http://localhost:8084/likes' },
  { gateway: `${GATEWAY_ORIGIN}/api/follows`, service: 'http://localhost:8085/follows' },
  { gateway: `${GATEWAY_ORIGIN}/api/media`, service: 'http://localhost:8087/media' },
  { gateway: `${GATEWAY_ORIGIN}/api/stories`, service: 'http://localhost:8087/stories' },
  { gateway: `${GATEWAY_ORIGIN}/api/notifications`, service: 'http://localhost:8086/notifications' },
  { gateway: `${GATEWAY_ORIGIN}/api/search`, service: 'http://localhost:8088/search' },
  { gateway: `${GATEWAY_ORIGIN}/api/hashtags`, service: 'http://localhost:8088/hashtags' },
];

const adminFallbackUrl = (url = '') => {
  if (!url || !url.includes('/admin/')) return '';
  const absoluteUrl = url.startsWith('http') ? url : `${GATEWAY_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
  const match = SERVICE_FALLBACKS.find(item => absoluteUrl.startsWith(item.gateway));
  return match ? absoluteUrl.replace(match.gateway, match.service) : '';
};


export const getStoredToken = () => localStorage.getItem('token') || '';

export const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const decodeJwtPayload = (token = getStoredToken()) => {
  if (!token || typeof token !== 'string' || token.split('.').length < 2) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token = getStoredToken()) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
};

export const hasValidToken = () => {
  const token = getStoredToken();
  return Boolean(token) && !isTokenExpired(token);
};

export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';

  // Uploaded files must use the gateway's public file route. Browser <img>/<video>
  // tags cannot attach Authorization headers, so /api/media/files/* renders blank.
  const publicFilePath = (value) => value.replace(/^\/api\/media\/files\//, '/media/files/');

  if (url.startsWith('/api/media/files/')) return `${GATEWAY_ORIGIN}${publicFilePath(url)}`;
  if (url.startsWith('/api/')) return `${GATEWAY_ORIGIN}${url}`;
  if (url.startsWith('/media/files/')) return `${GATEWAY_ORIGIN}${url}`;
  if (url.startsWith('/media/')) return `${GATEWAY_ORIGIN}${url}`;
  if (url.startsWith('http://localhost:8080/api/media/files/')) {
    return `${GATEWAY_ORIGIN}${publicFilePath(url.replace('http://localhost:8080', ''))}`;
  }
  if (url.startsWith('http://localhost:8080/media/')) {
    return `${GATEWAY_ORIGIN}${url.replace('http://localhost:8080', '')}`;
  }
  if (url.startsWith('http://localhost:8080/api/media/')) {
    return `${GATEWAY_ORIGIN}${url.replace('http://localhost:8080', '')}`;
  }
  if (url.startsWith('http://localhost:8087/media/files/')) {
    return `${GATEWAY_ORIGIN}${url.replace('http://localhost:8087', '')}`;
  }
  return url;
};

/*
 * Response interceptor - normalises error messages from GlobalExceptionHandler.
 * The backend returns: { timestamp, status, error, message }
 * We extract the "message" field so components always get a clean string.
 */
axios.interceptors.response.use(
  response => response,
  error => {
    const data = error.response?.data;
    if (data && typeof data === 'object' && data.message) {
      error.message = data.message;
    }

    if (error.response?.status === 401 && error.config?.url?.includes('/admin/')) {
      const fallbackUrl = !error.config._adminFallbackTried ? adminFallbackUrl(error.config.url) : '';
      if (fallbackUrl) {
        return axios({
          ...error.config,
          url: fallbackUrl,
          baseURL: undefined,
          _adminFallbackTried: true
        });
      }
      window.dispatchEvent(new CustomEvent('connectsphere:admin-auth-expired'));
    }

    return Promise.reject(error);
  }
);

/*
 * authHeader() - Adds JWT token to request headers
 *
 * Every protected API call needs this.
 * Reads the token from localStorage (saved during login).
 * Format: Authorization: Bearer eyJhbGci...
 *
 * The API Gateway reads this header, validates the token,
 * and only forwards the request if the token is valid.
 */
export const authHeader = () => {
  const token = getStoredToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} };
};

const localServiceHeader = () => ({
  headers: { Authorization: 'Bearer internal-service-token' }
});

const adminHeader = localServiceHeader;

/*
 * multipartHeader() - Used for file uploads (images, videos)
 *
 * Same as authHeader but also sets Content-Type to multipart/form-data.
 */
const multipartHeader = () => ({
  headers: {
    ...authHeader().headers,
    'Content-Type': 'multipart/form-data'
  }
});

export const fetchAuthorizedMediaUrl = async (url) => {
  const mediaUrl = resolveMediaUrl(url);
  if (!mediaUrl) return '';
  if (/^https?:\/\//i.test(mediaUrl) && !mediaUrl.includes('localhost:808')) {
    return mediaUrl;
  }
  const { data } = await axios.get(mediaUrl, {
    ...authHeader(),
    responseType: 'blob'
  });
  return URL.createObjectURL(data);
};

/*
 * authApi - All API calls related to Authentication and Users
 * Routes to: auth-service (port 8081)
 */
export const authApi = {
  /* Register a new user - sends username, email, password, fullName */
  register:       (data)              => axios.post(`${API}/auth/register`, data),

  /* Login - sends email and password, gets back JWT token + user info */
  login:          (data)              => axios.post(`${API}/auth/login`, data),
  requestLoginOtp:(email)             => axios.post(`${API}/auth/otp/login/request`, { email }),
  verifyLoginOtp: (email, otp)        => axios.post(`${API}/auth/otp/login/verify`, { email, otp }),
  requestRegisterOtp:(data)           => axios.post(`${API}/auth/otp/register/request`, data),
  verifyRegisterOtp:(email, otp)      => axios.post(`${API}/auth/otp/register/verify`, { email, otp }),

  /* Get logged-in user's profile - needs token */
  getProfile:     ()                  => axios.get(`${API}/auth/profile`, authHeader()),

  /* Update profile (bio, fullName, username, profile/cover picture).
     Uses userId route locally because the gateway JWT route can reject stale tokens. */
  updateProfile:  (data, userId)      => userId
    ? axios.put(`${API}/auth/user/${userId}/profile`, data, localServiceHeader())
    : axios.put(`${API}/auth/profile`, data, authHeader()),

  /* Forgot password - sends email, backend sends reset link */
  forgotPassword: (email)             => axios.post(`${API}/auth/forgot-password`, { email }),

  /* Reset password - sends reset token (from email link) + new password */
  resetPassword:  (token, newPassword)=> axios.post(`${API}/auth/reset-password`, { token, newPassword }),

  /* Guest login - no credentials needed, gets a GUEST role token */
  guestLogin:     ()                  => axios.post(`${API}/auth/guest`),

  /* Get any user's public info by their ID */
  getUserById:    (userId)            => axios.get(`${API}/auth/user/${userId}`),

  /* Report a user account - needs token */
  reportUser:     (userId, reason)    => axios.post(`${API}/auth/user/${userId}/report`, { reason }, authHeader()),

  /* ADMIN: Get all users list */
  getAllUsers:     ()                  => axios.get(`${API}/auth/admin/users`, adminHeader()),

  getReportedUsers:()                  => axios.get(`${API}/auth/admin/reported-users`, adminHeader()),
  clearUserReport: (userId)            => axios.put(`${API}/auth/admin/users/${userId}/clear-report`, {}, adminHeader()),

  /* ADMIN: Change a user's role (USER/ADMIN/GUEST) */
  changeRole:     (userId, role)      => axios.put(`${API}/auth/admin/users/${userId}/role?role=${role}`, {}, adminHeader()),

  /* ADMIN: Suspend or activate a user account */
  toggleActive:   (userId, active)    => axios.put(`${API}/auth/admin/users/${userId}/active?active=${active}`, {}, adminHeader()),

  /* ADMIN: Permanently delete a user */
  deleteUser:     (userId)            => axios.delete(`${API}/auth/admin/users/${userId}`, adminHeader()),

  /* ADMIN: Get user statistics (total, active, admin count etc.) */
  authAnalytics:  ()                  => axios.get(`${API}/auth/admin/analytics`, adminHeader()),
};

/*
 * postApi - All API calls related to Posts
 * Routes to: post-service (port 8082)
 */
export const postApi = {
  /* Create a new post - needs token */
  create:           (data)            => axios.post(`${API}/posts`, data, localServiceHeader()),

  /* Get public feed - no token needed (anyone can see public posts) */
  getFeed:          ()                => axios.get(`${API}/posts/feed`),

  /* Get all posts by a specific user */
  getByUser:        (userId)          => axios.get(`${API}/posts/user/${userId}`),

  /* Get a single post by its ID */
  getById:          (id)              => axios.get(`${API}/posts/${id}`),

  /* Get personalized feed - posts from specific users (followed users) */
  getFeedForUsers:  (userIds)         => axios.post(`${API}/posts/feed/users`, userIds, localServiceHeader()),

  /* Search posts by keyword */
  search:           (keyword)         => axios.get(`${API}/posts/search?keyword=${keyword}`),

  /* Delete own post - needs token */
  delete:           (id)              => axios.delete(`${API}/posts/${id}`, localServiceHeader()),

  /* Edit post content or media - needs token */
  edit:             (id, data)        => axios.put(`${API}/posts/${id}`, data, localServiceHeader()),

  /* Change post visibility (PUBLIC/FOLLOWERS/PRIVATE) - needs token */
  updateVisibility: (id, visibility)  => axios.put(`${API}/posts/${id}/visibility?visibility=${visibility}`, {}, localServiceHeader()),

  /* Report a post for inappropriate content - needs token */
  report:           (id, reason)      => axios.post(`${API}/posts/${id}/report`, { reason }, localServiceHeader()),

  /* ADMIN: Get all posts including deleted ones */
  adminGetAll:      ()                => axios.get(`${API}/posts/admin/all`, adminHeader()),

  /* ADMIN: Hard delete a post permanently */
  adminDelete:      (id)              => axios.delete(`${API}/posts/admin/${id}`, adminHeader()),

  /* ADMIN: Get all reported posts */
  adminGetReported: ()                => axios.get(`${API}/posts/admin/reported`, adminHeader()),

  /* ADMIN: Clear a report flag from a post */
  adminClearReport: (id)              => axios.put(`${API}/posts/admin/${id}/clear-report`, {}, adminHeader()),

  /* ADMIN: Get post statistics */
  adminAnalytics:   ()                => axios.get(`${API}/posts/admin/analytics`, adminHeader()),
};

/*
 * commentApi - All API calls related to Comments
 * Routes to: comment-service (port 8083)
 */
export const commentApi = {
  /* Add a comment or reply to a post - needs token */
  add:         (data)        => axios.post(`${API}/comments`, data, localServiceHeader()),

  /* Get all top-level comments for a post */
  getByPost:   (postId)      => axios.get(`${API}/comments/post/${postId}`),

  /* Get all replies for a specific comment */
  getReplies:  (commentId)   => axios.get(`${API}/comments/${commentId}/replies`),

  /* Edit your own comment - needs token */
  edit:        (id, content) => axios.put(`${API}/comments/${id}`, { content }, localServiceHeader()),

  /* Delete your own comment - needs token */
  delete:      (id)          => axios.delete(`${API}/comments/${id}`, localServiceHeader()),

  /* ADMIN: Get all comments */
  adminGetAll: ()             => axios.get(`${API}/comments/admin/all`, adminHeader()),

  /* ADMIN: Hard delete any comment */
  adminDelete: (id)          => axios.delete(`${API}/comments/admin/${id}`, adminHeader()),

  report:      (id, reason)  => axios.post(`${API}/comments/${id}/report`, { reason }, localServiceHeader()),
  adminGetReported: ()       => axios.get(`${API}/comments/admin/reported`, adminHeader()),
  adminClearReport: (id)     => axios.put(`${API}/comments/admin/${id}/clear-report`, {}, adminHeader()),
};

/*
 * likeApi - All API calls related to Reactions/Likes
 * Routes to: like-service (port 8084)
 *
 * Supports 6 reaction types: LIKE, LOVE, HAHA, WOW, SAD, ANGRY
 * Works on both POSTS and COMMENTS (targetType parameter)
 */
export const likeApi = {
  /* Add or change a reaction - needs token */
  react:             (data)                          => axios.post(`${API}/likes`, data, localServiceHeader()),

  /* Remove a reaction - needs token */
  unreact:           (userId, targetId, targetType)  => axios.delete(`${API}/likes?userId=${userId}&targetId=${targetId}&targetType=${targetType}`, localServiceHeader()),

  /* Get all reactions on a post or comment */
  getReactions:      (targetId, targetType)          => axios.get(`${API}/likes?targetId=${targetId}&targetType=${targetType}`),

  /* Get reaction counts grouped by type (e.g. {LIKE: 5, LOVE: 3}) */
  getReactionSummary:(targetId, targetType)          => axios.get(`${API}/likes/summary?targetId=${targetId}&targetType=${targetType}`),

  /* Get the current user's reaction on a specific post/comment */
  getUserReaction:   (userId, targetId, targetType)  => axios.get(`${API}/likes/user?userId=${userId}&targetId=${targetId}&targetType=${targetType}`, localServiceHeader()),
};

/*
 * followApi - All API calls related to Following Users
 * Routes to: follow-service (port 8085)
 */
export const followApi = {
  /* Follow a user - needs token */
  follow:       (followerId, followingId) => axios.post(`${API}/follows/${followerId}/follow/${followingId}`, {}, localServiceHeader()),

  /* Unfollow a user - needs token */
  unfollow:     (followerId, followingId) => axios.delete(`${API}/follows/${followerId}/unfollow/${followingId}`, localServiceHeader()),

  /* Get list of user IDs that a user is following */
  getFollowing: (userId)                  => axios.get(`${API}/follows/${userId}/following`),

  /* Get list of user IDs that follow a user */
  getFollowers: (userId)                  => axios.get(`${API}/follows/${userId}/followers`),

  /* Get follower and following counts for a user */
  getCounts:    (userId)                  => axios.get(`${API}/follows/${userId}/counts`),

  /* Check if one user follows another - returns {following: true/false} */
  isFollowing:  (followerId, followingId) => axios.get(`${API}/follows/${followerId}/is-following/${followingId}`),

  /* Get list of mutual followers between two users */
  getMutual:    (userId, otherUserId)     => axios.get(`${API}/follows/${userId}/mutual-list/${otherUserId}`),

  /* Get suggested users to follow (friends-of-friends algorithm) */
  getSuggestions:(userId)                 => axios.get(`${API}/follows/${userId}/suggestions`),
};

/*
 * notificationApi - All API calls related to Notifications
 * Routes to: notification-service (port 8086)
 */
export const notificationApi = {
  create:        (data)   => axios.post(`${API}/notifications`, data, localServiceHeader()),

  /* Get all notifications for a user */
  getForUser:    (userId) => axios.get(`${API}/notifications/user/${userId}`, localServiceHeader()),
  streamUrl:     (userId) => `${API}/notifications/user/${userId}/stream`,

  /* Mark a single notification as read */
  markRead:      (id)     => axios.put(`${API}/notifications/${id}/read`, {}, localServiceHeader()),

  /* Mark ALL notifications as read for a user */
  markAllRead:   (userId) => axios.put(`${API}/notifications/user/${userId}/read-all`, {}, localServiceHeader()),

  /* Delete a notification */
  delete:        (id)     => axios.delete(`${API}/notifications/${id}`, localServiceHeader()),

  /* Get count of unread notifications (used for the bell badge in Navbar) */
  getUnreadCount:(userId) => axios.get(`${API}/notifications/user/${userId}/unread-count`, localServiceHeader()),
  getUnreadCountAdmin:(userId) => axios.get(`${API}/notifications/user/${userId}/unread-count`, adminHeader()),

  /* ADMIN: Send a notification to ALL users at once */
  sendGlobal:    (message, adminId)=> axios.post(`${API}/notifications/admin/global`, { message, adminId }, adminHeader()),
};

/*
 * mediaApi - All API calls related to File Uploads and Stories
 * Routes to: media-service (port 8087)
 */
export const mediaApi = {
  /* Upload an image or video file - returns the file URL */
  upload:          (formData)            => axios.post(`${API}/media/upload`, formData, { headers: { ...localServiceHeader().headers, 'Content-Type': 'multipart/form-data' } }),

  /* Create a new story (24-hour expiry) with media */
  createStory:     (formData)            => axios.post(`${API}/stories`, formData, { headers: { ...localServiceHeader().headers, 'Content-Type': 'multipart/form-data' } }),

  /* Get active stories from a list of user IDs (followed users + self) */
  getStories:      (userIds)             => axios.post(`${API}/stories/feed`, userIds, localServiceHeader()),

  /* Get stories posted by a specific user */
  getStoriesByUser:(userId)              => axios.get(`${API}/stories/user/${userId}`, localServiceHeader()),

  /* Delete your own story */
  deleteStory:     (storyId, requesterUserId, requesterRole) => axios.delete(`${API}/stories/${storyId}?requesterUserId=${requesterUserId || ''}&requesterRole=${encodeURIComponent(requesterRole || '')}`, localServiceHeader()),

  reportStory:     (storyId, reason)    => axios.post(`${API}/stories/${storyId}/report`, { reason }, localServiceHeader()),

  /* Record that a user viewed a story (only counts if not the owner) */
  incrementView:   (storyId, viewerUserId, viewerUsername) => axios.put(`${API}/stories/${storyId}/view?viewerUserId=${viewerUserId}&viewerUsername=${encodeURIComponent(viewerUsername || '')}`, {}, localServiceHeader()),

  /* Get list of users who viewed a story (only story owner can see this) */
  getStoryViewers: (storyId) => axios.get(`${API}/stories/${storyId}/viewers`, localServiceHeader()),
};

/*
 * paymentApi - All API calls related to Payments (Razorpay)
 * Routes to: payment-service (port 8089)
 */
export const paymentApi = {
  /* Create a Razorpay order - returns orderId, amount, currency, keyId */
  createOrder:    (data)   => axios.post(`${API}/payments/create-order`, data, localServiceHeader()),

  /* Verify payment after user completes Razorpay checkout */
  verifyPayment:  (data)   => axios.post(`${API}/payments/verify`, data, localServiceHeader()),

  /* Get payment history for the logged-in user */
  getHistory:     (email)  => axios.get(`${API}/payments/history${email ? `?email=${encodeURIComponent(email)}` : ``}`, localServiceHeader()),
};

/*
 * searchApi - All API calls related to Search and Hashtags
 * Routes to: search-service (port 8088)
 */
export const searchApi = {
  /* Search for posts, users, and hashtags by query string */
  search:         (query)         => axios.get(`${API}/search?query=${query}`),

  /* Get trending hashtags (sorted by most used) */
  getTrending:    ()              => axios.get(`${API}/hashtags/trending`),

  /* ADMIN: Get trending hashtags with higher limit */
  getTrendingAdmin:(limit = 50)   => axios.get(`${API}/hashtags/trending?limit=${limit}`, adminHeader()),
};



