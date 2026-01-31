# 🎵 YouTube Music Player

A beautiful web-based music player that streams audio from YouTube, featuring a modern Spotify-like interface. Built with Vanilla JavaScript, Node.js, and Express.

![YouTube Music Player](https://img.shields.io/badge/version-1.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- 🔍 **Search YouTube videos** - No API key required
- 🎵 **Audio-only playback** - Stream music without video
- 📋 **Queue management** - Build and manage your playlist
- ❤️ **Favorites** - Save your favorite tracks
- 🔀 **Shuffle mode** - Randomize playback order
- 🔁 **Repeat modes** - Repeat one, all, or disable
- 🎨 **Beautiful dark theme** - Spotify-inspired UI
- 📱 **Responsive design** - Works on desktop and mobile
- 💾 **Persistent storage** - Queue and favorites saved across sessions

## 🚀 Quick Start

### Prerequisites

- **Option 1**: Docker & Docker Compose (recommended)
- **Option 2**: Node.js 18+ and npm

### Running with Docker (Recommended)

The easiest way to run the application - no Node.js installation required!

```bash
# Clone or navigate to the project directory
cd youtube-app

# Build and start the container
docker-compose up --build

# Access the application at http://localhost:3000
```

The application will automatically:
- Build the Docker image
- Install all dependencies
- Start the server
- Create necessary data directories
- Run health checks

**Stopping the application:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
```

### Running Locally (Without Docker)

```bash
# Install dependencies
npm install

# Start the server
npm start

# For development with auto-reload
npm run dev

# Access the application at http://localhost:3000
```

## 📖 Usage

1. **Search for music**
   - Enter a song name, artist, or any search term in the search box
   - Click the search button or press Enter
   - Browse through the results

2. **Play music**
   - Click the play button (▶️) on any video card to play immediately
   - Or use the plus button (➕) to add to queue without playing

3. **Manage queue**
   - Click "Danh sách phát" in the sidebar to view your queue
   - Reorder, remove, or play specific tracks
   - Queue is saved automatically

4. **Save favorites**
   - Click the heart button (❤️) on any track to add to favorites
   - View all favorites in the "Yêu thích" section
   - Favorites are persisted on the server

5. **Playback controls**
   - **Play/Pause**: Control playback
   - **Next/Previous**: Skip tracks
   - **Shuffle**: Randomize playback order
   - **Repeat**: Cycle through off → all → one
   - **Volume**: Adjust or mute volume

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express
- **YouTube Integration**: yt-search (no API key needed), YouTube IFrame Player API
- **Storage**: JSON file-based (favorites.json)
- **Deployment**: Docker, Docker Compose

### Project Structure

```
youtube-app/
├── server/
│   ├── index.js              # Express server
│   ├── routes/
│   │   ├── search.js         # Search endpoint
│   │   ├── video.js          # Video details
│   │   ├── favorites.js      # Favorites CRUD
│   │   └── health.js         # Health check
│   ├── services/
│   │   └── youtube.js        # YouTube API wrapper
│   └── data/
│       └── favorites.json    # Favorites storage
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── player.js         # YouTube player controller
│       ├── playlist.js       # Queue management
│       ├── search.js         # Search functionality
│       ├── favorites.js      # Favorites management
│       ├── ui.js            # UI updates
│       └── app.js           # Main application
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🔑 Key Features Explained

### No API Key Required

This application uses the `yt-search` library which scrapes YouTube search results, eliminating the need for an API key and quota limitations. This means:

- ✅ No registration or API key setup required
- ✅ No quota limits (unlike YouTube Data API v3)
- ✅ Completely free to use
- ✅ Simple deployment

### Audio-Only Playback

The YouTube IFrame Player is configured to be hidden (1x1 pixel) and only streams audio:

```javascript
{
  height: '1',
  width: '1',
  playerVars: {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
    fs: 0,
    modestbranding: 1,
    playsinline: 1
  }
}
```

### Data Persistence

- **Queue**: Saved in browser localStorage
- **Favorites**: Saved on server in `server/data/favorites.json`
- **Settings**: Volume and playback preferences in localStorage

## 🐳 Docker Deployment

### Building for Production

```bash
# Build the image
docker build -t youtube-music-player .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/server/data:/app/server/data \
  --name youtube-music \
  youtube-music-player
```

### Docker Compose (Recommended)

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild after code changes
docker-compose up --build
```

### Environment Variables

Create a `.env` file (optional):

```bash
PORT=3000
NODE_ENV=production
```

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev
```

### Making Changes

1. Edit files in `server/` or `public/`
2. If using Docker, rebuild: `docker-compose up --build`
3. If running locally with nodemon, changes are auto-reloaded

## 📝 API Endpoints

- `GET /api/search?q=<query>&max=<number>` - Search videos
- `GET /api/video/:id` - Get video details
- `GET /api/favorites` - Get all favorites
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/:id` - Remove from favorites
- `GET /api/health` - Health check endpoint

## 🚧 Known Limitations

- Depends on YouTube's HTML structure (may break if YouTube changes their site)
- Slightly slower than official YouTube Data API
- No advanced search filters
- Region-specific content restrictions apply

## 🔮 Future Enhancements

- [ ] Lyrics display integration
- [ ] Multiple playlists support
- [ ] Social sharing features
- [ ] Keyboard shortcuts
- [ ] Audio visualizer/equalizer
- [ ] Import YouTube playlists by URL
- [ ] Dark/Light theme toggle
- [ ] Mini player mode
- [ ] SQLite database for better scalability

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Built with [yt-search](https://github.com/talmobi/yt-search) library
- Uses [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- UI inspired by Spotify and Apple Music

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Change port in .env file or docker-compose.yml
PORT=3001
```

**Docker container won't start:**
```bash
# Check logs
docker-compose logs

# Remove old containers
docker-compose down
docker-compose up --build
```

**Search not working:**
- Check internet connection
- Verify server is running
- Check browser console for errors

**Videos won't play:**
- Some videos may be region-restricted
- Try a different video
- Check browser console for YouTube player errors

---

Made with ❤️ using Vanilla JavaScript and Node.js
