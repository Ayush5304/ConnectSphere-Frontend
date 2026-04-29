# ConnectSphere Frontend

A modern social media platform frontend built with **React.js** and **Tailwind CSS**.

## 🚀 Features

- 🔐 JWT Authentication + Google OAuth2 Login
- 📰 Public & Personalized Feed
- 📝 Create Posts with Photo/Video
- ❤️ 6 Reaction Types (Like, Love, Haha, Wow, Sad, Angry)
- 💬 Comments & Nested Replies
- 👥 Follow / Unfollow Users
- 📖 WhatsApp-style Stories (24hr expiry)
- 🔔 Real-time Notifications
- 🔍 Search Users, Posts & Hashtags
- 💳 Razorpay Payment (Verified Badge ₹99, Boost Post ₹49)
- 👑 Admin Dashboard
- 📱 Fully Responsive UI

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js 18 | UI Framework |
| Tailwind CSS | Styling |
| Axios | HTTP Client |
| React Router v6 | Client-side Routing |
| Razorpay JS SDK | Payment Integration |

## 📁 Project Structure

```
src/
├── api/          # All API calls (axios)
├── components/
│   ├── admin/    # Admin dashboard
│   ├── auth/     # Login, Register, OAuth2
│   ├── feed/     # Feed, PostCard, CreatePost
│   ├── payment/  # Razorpay PaymentModal
│   ├── profile/  # Profile, EditProfile
│   ├── search/   # SearchBar
│   └── stories/  # WhatsApp-style Stories
├── context/      # AuthContext (global user state)
├── App.jsx       # Routes & protected routes
└── index.js      # Entry point
```

## ⚙️ Setup & Run

### Prerequisites
- Node.js 18+
- Backend services running (see ConnectSphere-Backend)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ayush5304/ConnectSphere-Frontend.git
cd ConnectSphere-Frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.production
# Edit .env.production and set REACT_APP_API_URL

# Start development server
npm start
```

App runs on **http://localhost:3000**

## 🌿 Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `dev` | Development integration branch |
| `feature/auth` | Authentication features |
| `feature/feed` | Feed & post features |
| `feature/payment` | Payment integration |
| `feature/stories` | Stories feature |

## 🔗 Backend Repository

[ConnectSphere-Backend](https://github.com/Ayush5304/ConnectSphere-Backend)


