// Main application logic
let player;
let playlist;
let search;
let favorites;
let progressUpdateInterval;

// Setup event listeners IMMEDIATELY (don't wait for anything)
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM loaded, setting up event listeners...');

  // Initialize modules that don't need YouTube API
  playlist = new Playlist();
  search = new Search();
  favorites = new Favorites();

  // Setup ALL event listeners IMMEDIATELY
  setupEventListeners();

  console.log('✅ Event listeners setup complete!');

  // Load favorites in background
  favorites.loadFavorites().then(() => {
    console.log('✅ Favorites loaded');
  }).catch(err => {
    console.error('Failed to load favorites:', err);
  });

  // Initialize YouTube player AFTER everything else
  initializeYouTubePlayer();
});

// Initialize YouTube Player (async, won't block UI)
async function initializeYouTubePlayer() {
  try {
    console.log('🎵 Initializing YouTube player...');
    player = new YouTubePlayer();
    await player.init();

    // Setup player callbacks
    player.onEnded(() => handleNext());
    player.onStateChange((state) => {
      if (state === 'playing') {
        UI.updatePlayPauseButton(true);
      } else if (state === 'paused') {
        UI.updatePlayPauseButton(false);
      }
    });

    // Render saved queue if exists
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);

    // Restore playback state
    const currentTrack = playlist.getCurrentTrack();
    if (currentTrack) {
      UI.updateNowPlaying(currentTrack);
    }

    // Update UI state
    UI.updateShuffleButton(playlist.shuffleMode);
    UI.updateRepeatButton(playlist.repeatMode);

    // Set initial volume
    const savedVolume = localStorage.getItem('volume') || 50;
    player.setVolume(savedVolume);
    document.getElementById('volume-slider').value = savedVolume;
    UI.updateVolumeIcon(savedVolume);

    console.log('✅ YouTube player ready!');
  } catch (error) {
    console.error('⚠️ YouTube player failed to initialize:', error);
    UI.showNotification('Player initialization failed, but app still works!');
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Search
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('search-input');

  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
    console.log('✅ Search button listener added');
  }

  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
    console.log('✅ Search input listener added');
  }

  // Player controls
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (player && player.isReady) {
        player.togglePlayPause();
      } else {
        UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
      }
    });
  }

  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.addEventListener('click', handleNext);

  const prevBtn = document.getElementById('prev-btn');
  if (prevBtn) prevBtn.addEventListener('click', handlePrevious);

  const shuffleBtn = document.getElementById('shuffle-btn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', handleShuffle);

  const repeatBtn = document.getElementById('repeat-btn');
  if (repeatBtn) repeatBtn.addEventListener('click', handleRepeat);

  // Progress bar
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) progressBar.addEventListener('input', handleSeek);

  // Volume
  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) volumeSlider.addEventListener('input', handleVolume);

  const volumeBtn = document.getElementById('volume-btn');
  if (volumeBtn) volumeBtn.addEventListener('click', handleVolumeMute);

  // Favorite current track
  const favBtn = document.getElementById('favorite-current-btn');
  if (favBtn) favBtn.addEventListener('click', handleFavoriteCurrent);

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', handleNavigation);
  });

  // Event delegation for dynamic content
  document.addEventListener('click', handleDynamicClicks);

  // Progress update interval
  progressUpdateInterval = setInterval(() => {
    if (player && player.isPlaying) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      UI.updateProgressBar(currentTime, duration);
    }
  }, 1000);

  console.log('✅ All event listeners registered');
}

// Handle search
async function handleSearch() {
  console.log('🔍 Search triggered!');
  const query = document.getElementById('search-input').value.trim();

  if (!query) {
    UI.showNotification('Vui lòng nhập từ khóa tìm kiếm');
    return;
  }

  try {
    UI.showNotification('Đang tìm kiếm...');
    console.log('Searching for:', query);

    const results = await search.performSearch(query);
    console.log('Search results:', results.length);

    search.renderResults(results);
    UI.switchView('search');
    UI.showNotification(`Tìm thấy ${results.length} kết quả`);
  } catch (error) {
    console.error('Search failed:', error);
    UI.showNotification('Tìm kiếm thất bại: ' + error.message);
  }
}

// Handle dynamic clicks (event delegation)
function handleDynamicClicks(e) {
  const target = e.target;

  // Play button
  if (target.classList.contains('btn-play')) {
    const videoId = target.dataset.videoId;
    const video = search.getVideoById(videoId);
    if (video) {
      handlePlayVideo(video);
    }
  }

  // Add to queue button
  if (target.classList.contains('btn-add-queue')) {
    const videoId = target.dataset.videoId;
    const video = search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
      handleAddToQueue(video);
    }
  }

  // Favorite button
  if (target.classList.contains('btn-favorite')) {
    const videoId = target.dataset.videoId;
    const video = search.getVideoById(videoId);
    if (video) {
      handleToggleFavorite(video);
    }
  }

  // Remove favorite button
  if (target.classList.contains('btn-remove-favorite')) {
    const videoId = target.dataset.videoId;
    const video = favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
      handleToggleFavorite(video);
    }
  }

  // Play from queue
  if (target.classList.contains('btn-play-queue')) {
    const index = parseInt(target.dataset.queueIndex);
    handlePlayFromQueue(index);
  }

  // Remove from queue
  if (target.classList.contains('btn-remove-queue')) {
    const index = parseInt(target.dataset.queueIndex);
    handleRemoveFromQueue(index);
  }
}

// Play a video
function handlePlayVideo(video) {
  if (!player || !player.isReady) {
    UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
    return;
  }

  playlist.add(video);
  const track = playlist.playAt(playlist.getQueue().length - 1);

  if (track) {
    player.loadVideo(track.id);
    player.play();
    UI.updateNowPlaying(track);
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
    UI.showNotification(`Đang phát: ${track.title}`);
  }
}

// Add video to queue
function handleAddToQueue(video) {
  playlist.add(video);
  UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  UI.showNotification('Đã thêm vào danh sách phát');
}

// Toggle favorite
async function handleToggleFavorite(video) {
  try {
    const isFavorite = await favorites.toggleFavorite(video);
    UI.updateFavoriteButtons(video.id, isFavorite);

    if (isFavorite) {
      UI.showNotification('Đã thêm vào yêu thích');
    } else {
      UI.showNotification('Đã xóa khỏi yêu thích');
      // Refresh favorites view if currently viewing
      if (document.getElementById('favorites-view').classList.contains('active')) {
        favorites.renderFavorites();
      }
    }
  } catch (error) {
    console.error('Toggle favorite failed:', error);
    UI.showNotification(error.message || 'Thao tác thất bại');
  }
}

// Favorite current track
async function handleFavoriteCurrent() {
  const currentTrack = playlist.getCurrentTrack();
  if (!currentTrack) return;

  await handleToggleFavorite(currentTrack);
}

// Play from queue
function handlePlayFromQueue(index) {
  if (!player || !player.isReady) {
    UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
    return;
  }

  const track = playlist.playAt(index);
  if (track) {
    player.loadVideo(track.id);
    player.play();
    UI.updateNowPlaying(track);
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  }
}

// Remove from queue
function handleRemoveFromQueue(index) {
  playlist.remove(index);
  UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  UI.showNotification('Đã xóa khỏi danh sách phát');
}

// Next track
function handleNext() {
  if (!player || !player.isReady) {
    UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
    return;
  }

  const track = playlist.next();
  if (track) {
    player.loadVideo(track.id);
    player.play();
    UI.updateNowPlaying(track);
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  } else {
    UI.showNotification('Đã phát hết danh sách');
    player.pause();
  }
}

// Previous track
function handlePrevious() {
  if (!player || !player.isReady) {
    UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
    return;
  }

  const track = playlist.previous();
  if (track) {
    player.loadVideo(track.id);
    player.play();
    UI.updateNowPlaying(track);
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  }
}

// Toggle shuffle
function handleShuffle() {
  const isShuffleOn = playlist.toggleShuffle();
  UI.updateShuffleButton(isShuffleOn);
  UI.showNotification(isShuffleOn ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên');
}

// Cycle repeat mode
function handleRepeat() {
  const mode = playlist.cycleRepeatMode();
  UI.updateRepeatButton(mode);

  const messages = {
    'off': 'Đã tắt lặp lại',
    'one': 'Lặp lại một bài',
    'all': 'Lặp lại tất cả'
  };
  UI.showNotification(messages[mode]);
}

// Seek to position
function handleSeek(e) {
  if (!player || !player.isReady) return;

  const percentage = e.target.value;
  const duration = player.getDuration();
  const seekTime = (percentage / 100) * duration;
  player.seekTo(seekTime);
}

// Handle volume
function handleVolume(e) {
  const volume = e.target.value;

  if (player && player.isReady) {
    player.setVolume(volume);
  }

  UI.updateVolumeIcon(volume);
  localStorage.setItem('volume', volume);
}

// Mute/unmute volume
function handleVolumeMute() {
  if (!player || !player.isReady) return;

  if (player.isMuted()) {
    player.unmute();
    const savedVolume = localStorage.getItem('volume') || 50;
    document.getElementById('volume-slider').value = savedVolume;
    UI.updateVolumeIcon(savedVolume);
  } else {
    player.mute();
    UI.updateVolumeIcon(0);
  }
}

// Navigation between views
function handleNavigation(e) {
  e.preventDefault();
  const viewName = e.currentTarget.dataset.view;
  UI.switchView(viewName);

  // Load content for specific views
  if (viewName === 'favorites') {
    favorites.renderFavorites();
  } else if (viewName === 'queue') {
    UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  }
}
