# 🎵 Para's SFX Library

A modern, full-featured sound effects library web application with search, filtering, and management capabilities.

![Para's SFX Library](https://img.shields.io/badge/Status-Live-success)
![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

## 🌐 Live Demo

**Production:** [https://paras-sfx-library.vercel.app](https://paras-sfx-library.vercel.app)

## ✨ Features

### 🎧 User Features
- **Advanced Search** - Search sounds by title, tags, equipment, and format
- **Tag Filtering** - Browse sounds by category tags
- **Google Drive Integration** - Native embedded audio playback
- **Age Verification** - NSFW content protection system
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- **Sound Suggestions** - Users can suggest new sound effects
- **Modern UI** - Glassmorphism design with smooth animations

### 👨‍💼 Admin Features
- **Admin Dashboard** - Comprehensive management interface
- **Add Sounds** - Create new sound effects with Google Drive links
- **Manage Library** - Edit and delete existing sounds
- **Bulk Import** - Import multiple sounds via CSV/JSON or paste data
- **Tag Management** - Create and organize category tags
- **Suggestions Management** - Review and process user suggestions
- **Search Database** - Advanced search within admin panel

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - UI framework
- **TypeScript 5.6** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS 4.0** - Styling
- **Motion (Framer Motion)** - Animations
- **Shadcn/ui** - Component library
- **Lucide React** - Icons

### Backend
- **Supabase** - Database and authentication
- **Supabase Edge Functions** - Serverless API
- **PostgreSQL** - Database (via Supabase)
- **Key-Value Store** - Data persistence

### Additional Libraries
- **Sonner** - Toast notifications
- **date-fns** - Date formatting

## 📁 Project Structure

```
/
├── components/
│   ├── ui/                    # Shadcn/ui components
│   ├── AdminDashboard.tsx     # Admin interface
│   ├── AgeVerification.tsx    # NSFW protection
│   ├── BrowseByTags.tsx       # Tag browsing
│   ├── GoogleDriveAudioPlayer.tsx  # Audio player
│   ├── ManageSounds.tsx       # Sound management
│   ├── ManageSuggestions.tsx  # Suggestions panel
│   ├── ManageTags.tsx         # Tag management
│   └── SuggestSoundForm.tsx   # User suggestions
│
├── supabase/
│   └── functions/server/      # Edge functions
│       ├── index.tsx          # Main server
│       ├── sounds.tsx         # Sound API
│       ├── suggestions.tsx    # Suggestions API
│       └── tags.tsx           # Tags API
│
├── utils/
│   ├── api.tsx                # API client
│   ├── supabase/info.tsx      # Supabase config
│   ├── ageVerification.ts     # Age check logic
│   ├── searchUtils.ts         # Search algorithms
│   └── tagUtils.ts            # Tag formatting
│
├── styles/
│   └── globals.css            # Global styles
│
└── App.tsx                    # Main application
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/paras-sfx-library.git
cd paras-sfx-library

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:5173`

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Click "Deploy"

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

### Deploy to Netlify

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. "New site from Git"
4. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`

### Deploy to Cloudflare Pages

1. Push code to GitHub
2. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
3. Connect GitHub
4. Select repository
5. Framework preset: Vite

## 🔐 Admin Access

**Default Credentials:**
- Username: `admin`
- Password: `admin`

⚠️ **Change these in production!**

## 🎨 Features Breakdown

### Search & Filter
- Full-text search across titles and tags
- Equipment-based filtering
- Format filtering
- Tag-based browsing
- Real-time search results

### Audio Playback
- Google Drive native player integration
- Automatic URL conversion
- Fallback error handling
- Metadata display (equipment, format, tags)

### Age Verification
- NSFW tag detection
- Cookie-based verification
- 24-hour verification persistence
- Graceful content filtering

### Admin Panel Tabs
1. **Add Sounds** - Create new sound effects
2. **Manage** - Edit/delete existing sounds
3. **Search** - Advanced database search
4. **Suggestions** - User-submitted suggestions
5. **Import** - Bulk import tools
6. **Tags** - Manage category tags

## 📊 Database Schema

### Sounds Table
```typescript
{
  id: string;          // UUID
  title: string;       // Sound title
  audioUrl: string;    // Google Drive link
  tags: string[];      // Category tags
  equipment?: string;  // Recording equipment
  format?: string;     // Audio format (WAV, MP3, etc.)
  createdAt: Date;     // Creation timestamp
}
```

### Suggestions Table
```typescript
{
  id: string;              // UUID
  title: string;           // Suggested sound title
  description: string;     // Suggestion details
  submitterEmail?: string; // User email (optional)
  isRead: boolean;         // Admin viewed status
  createdAt: Date;         // Submission time
}
```

### Tags Table
```typescript
{
  id: string;       // UUID
  tag: string;      // Tag name (unique)
  isActive: boolean; // Display on homepage
  createdAt: Date;   // Creation timestamp
}
```

## 🎯 Key Features Explained

### Tag Capitalization
- All tags display with first letter capitalized
- "NSFW" tag always displays in all caps
- Stored lowercase in database
- Display-only transformation

### Browse By Tags
- Shows active tags from database
- Click to filter sounds by tag
- "All Sounds" shows complete library
- Smooth animations on selection

### Bulk Import System
Three import methods:
1. **CSV Upload** - Upload .csv file
2. **JSON Upload** - Upload .json file
3. **Paste Data** - Paste CSV/JSON directly

### Responsive Design
- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch-optimized interactions
- Adaptive layouts

## 🔒 Security

- ✅ Admin authentication
- ✅ Age verification for NSFW
- ✅ Secure API endpoints
- ✅ Input sanitization
- ✅ XSS protection headers
- ✅ CORS configuration

## 📈 Performance

- ✅ Code splitting
- ✅ Lazy loading
- ✅ Optimized images
- ✅ Minified assets
- ✅ Gzip/Brotli compression
- ✅ CDN delivery

## 🐛 Known Issues

None currently! Report issues at [GitHub Issues](https://github.com/YOUR_USERNAME/paras-sfx-library/issues)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 👤 Author

**Para**

## 🙏 Acknowledgments

- **Shadcn/ui** - Component library
- **Supabase** - Backend infrastructure
- **Vercel** - Hosting platform
- **Lucide** - Icon library
- **Tailwind CSS** - Styling framework

## 📧 Support

For questions or issues:
- Open a [GitHub Issue](https://github.com/YOUR_USERNAME/paras-sfx-library/issues)
- Contact via the suggestion form on the live site

## 🗺️ Roadmap

- [ ] EmailJS integration for suggestions
- [ ] Sound waveform visualization
- [ ] Favorites/bookmarking system
- [ ] User accounts
- [ ] Download functionality
- [ ] Advanced audio filters
- [ ] Playlist creation
- [ ] Social sharing

## 📚 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Security Documentation](SECURITY_SUMMARY.md)
- [Age Verification System](AGE_VERIFICATION.md)
- [Responsive Design](RESPONSIVE_DESIGN.md)
- [Tag Capitalization](TAG_CAPITALIZATION.md)

---

**Made with ❤️ by Para**

⭐ Star this repo if you find it useful!
