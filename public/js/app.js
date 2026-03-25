// Main application logic
let player;
let playlist;
let search;
let favorites;
let progressUpdateInterval;
let trendingVideos = []; // Store trending videos
let vohEpisodes = []; // Store VOH episodes
let scWidget = null;

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

  // Load trending videos
  loadTrending();

  // Initialize YouTube player AFTER everything else
  initializeYouTubePlayer();

  // Initialize SoundCloud Widget
  const scIframe = document.getElementById('sc-widget');
  if (scIframe) {
    // Wait for SC API to be ready
    const checkSC = setInterval(() => {
      if (window.SC && window.SC.Widget) {
        scWidget = SC.Widget(scIframe);
        scWidget.bind(SC.Widget.Events.FINISH, () => handleNext());
        scWidget.bind(SC.Widget.Events.READY, () => console.log('✅ SoundCloud Widget Ready'));
        clearInterval(checkSC);
      }
    }, 500);
  }
});

// Initialize YouTube Player (async, won't block UI)
async function initializeYouTubePlayer() {
  try {
    console.log('🎵 Initializing YouTube player...');

    // Show loading indicator
    UI.showNotification('Đang khởi tạo player...', 2000);

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
    UI.showNotification('Player đã sẵn sàng!', 2000);
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

  // Trending Refresh
  const refreshBtn = document.getElementById('trending-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTrending(true); // Force refresh
    });
  }

  // Player controls
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      // Handle SoundCloud Widget if it exists and is currently playing a stream
      const currentTrack = playlist.getCurrentTrack();
      if (currentTrack && currentTrack.source === 'soundcloud' && scWidget) {
        scWidget.isPaused((paused) => {
          if (paused) {
            scWidget.play();
          } else {
            scWidget.pause();
          }
        });
        return;
      }

      // Handle HTML5 Audio Player for Google Drive and VOH
      const html5Audio = document.getElementById('html5-audio-player');
      if (currentTrack && (currentTrack.source === 'googledrive' || currentTrack.isVOH)) {
        if (html5Audio) {
          if (html5Audio.paused) {
            html5Audio.play();
          } else {
            html5Audio.pause();
          }
        }
        return;
      }

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

  // Sync play/pause UI for HTML5 Audio
  const html5Audio = document.getElementById('html5-audio-player');
  if (html5Audio) {
    html5Audio.addEventListener('play', () => UI.updatePlayPauseButton(true));
    html5Audio.addEventListener('pause', () => UI.updatePlayPauseButton(false));
  }

  // Progress update interval
  progressUpdateInterval = setInterval(() => {
    const track = playlist.getCurrentTrack();
    if (track && track.source === 'soundcloud' && scWidget) {
        scWidget.getPosition((posMs) => {
            scWidget.getDuration((durMs) => {
                if (durMs > 0) {
                    UI.updateProgressBar(posMs / 1000, durMs / 1000);
                }
            });
        });
    } else if (player && player.isPlaying) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      UI.updateProgressBar(currentTime, duration);
    } else {
      const html5Audio = document.getElementById('html5-audio-player');
      if (html5Audio && !html5Audio.paused) {
        UI.updateProgressBar(html5Audio.currentTime, html5Audio.duration);
      }
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

    // Hide trending when results are found
    document.getElementById('trending-section').style.display = 'none';

    search.renderResults(results);
    UI.switchView('search');
    UI.showNotification(`Tìm thấy ${results.length} kết quả`);
  } catch (error) {
    console.error('Search failed:', error);
    UI.showNotification('Tìm kiếm thất bại: ' + error.message);
  }
}

// ==================== TRENDING (BÀI HÁT HOT) ====================

async function loadTrending(force = false) {
  if (trendingVideos.length > 0 && !force) {
    UI.renderTrending(trendingVideos);
    return;
  }

  console.log('🔥 [Trending] Loading started...');
  const container = document.getElementById('trending-container');
  if (container) {
    container.innerHTML = '<div class="trending-loading"><div class="loading"></div><p>Đang tải bài hát hot...</p></div>';
  }

  // Create an controller to handle timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch('/api/trending', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const data = await response.json();

    if (data.success) {
      console.log(`✅ [Trending] Loaded ${data.data.length} videos`);
      trendingVideos = data.data;
      UI.renderTrending(trendingVideos);
    } else {
      throw new Error(data.error || 'API returned success: false');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout ? 'Yêu cầu quá hạn (timeout 15s). Vui lòng kiểm tra kết nối mạng.' : error.message;
    
    console.error('❌ [Trending] Failed:', error);
    
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>Không thể tải bài hát hot. ${errorMsg}</p>
          <button onclick="loadTrending(true)" class="pagination-btn" style="margin-top:10px;">Thử lại</button>
        </div>
      `;
    }
    UI.showNotification('Lỗi tải bài hát hot: ' + (isTimeout ? 'Timeout' : error.message));
  }
}

function getTrendingVideoById(id) {
  return trendingVideos.find(v => v.id === id);
}

// ==================== SOUNDCLOUD (SÁNG TÁC CỦA TÔI) ====================

async function loadMyMusic() {
  console.log('Loading music from Google Drive...');
  try {
    const response = await fetch('/api/google-drive/files');
    const data = await response.json();
    if (data.success) {
      UI.renderDriveMusic(data.data);
    } else {
      throw new Error(data.error || 'Failed to fetch files');
    }
  } catch (error) {
    console.error('Failed to load My Music:', error);
    UI.showNotification('Lỗi tải nhạc từ Drive: ' + error.message);
  }
}

// ==================== VOH (NHỮNG LÁ THƯ XANH) ====================

async function loadVOH() {
  console.log('🍃 [VOH] Loading started...');
  const container = document.getElementById('voh-container');
  if (container) {
    container.innerHTML = '<div class="trending-loading"><div class="loading"></div><p>Đang tải danh sách lá thư xanh...</p></div>';
  }

  try {
    const response = await fetch('/api/voh/episodes');
    const data = await response.json();

    if (data.success) {
      console.log(`✅ [VOH] Loaded ${data.data.length} episodes`);
      vohEpisodes = data.data;
      UI.renderVOH(vohEpisodes);
    } else {
      throw new Error(data.error || 'API returned success: false');
    }
  } catch (error) {
    console.error('❌ [VOH] Failed:', error);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>Không thể tải danh sách lá thư xanh. ${error.message}</p>
          <button id="voh-retry-btn" class="pagination-btn" style="margin-top:10px;">Thử lại</button>
        </div>
      `;
      const retryBtn = document.getElementById('voh-retry-btn');
      if (retryBtn) retryBtn.onclick = loadVOH;
    }
    UI.showNotification('Lỗi tải VOH: ' + error.message);
  }
}

function getVOHTrackByUrl(url) {
  return vohEpisodes.find(v => v.url === url);
}

// renderMyMusic removed, using static iframe

// getMyMusicTrackById removed

// Handle dynamic clicks (event delegation)
function handleDynamicClicks(e) {
  const target = e.target;

  // Play button
  if (target.classList.contains('btn-play')) {
    const videoId = target.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
      handlePlayVideo(video);
    }
  }

  // Add to queue button
  if (target.classList.contains('btn-add-queue')) {
    const videoId = target.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
      handleAddToQueue(video);
    }
  }

  // Favorite button
  if (target.classList.contains('btn-favorite')) {
    const videoId = target.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
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

  // Google Drive play
  if (target.classList.contains('btn-play-drive')) {
    const fileId = target.dataset.fileId;
    fetch(`/api/google-drive/files`).then(res => res.json()).then(data => {
      const file = data.data.find(f => f.id === fileId);
      if (file) handlePlayVideo(file);
    });
  }

  // Google Drive add to queue
  if (target.classList.contains('btn-add-queue-drive')) {
    const fileId = target.dataset.fileId;
    fetch(`/api/google-drive/files`).then(res => res.json()).then(data => {
      const file = data.data.find(f => f.id === fileId);
      if (file) handleAddToQueue(file);
    });
  }

  // VOH play
  if (target.classList.contains('btn-play-voh')) {
    const url = target.dataset.vohUrl;
    const track = getVOHTrackByUrl(url);
    if (track) handlePlayVideo(track);
  }

  // VOH add to queue
  if (target.classList.contains('btn-add-queue-voh')) {
    const url = target.dataset.vohUrl;
    const track = getVOHTrackByUrl(url);
    if (track) handleAddToQueue(track);
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
    playInternalTrack(track);
  }
}

// audioPlayer is now deprecated, scWidget takes over.
async function playInternalTrack(track) {
  UI.updateNowPlaying(track);
  UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  UI.showNotification('Đang phát: ' + track.title);

  if (track.source === 'soundcloud') {
    // SoundCloud
    if (player) player.pause();
    
    try {
      if (!scWidget) throw new Error('SoundCloud Player chưa sẵn sàng');
      
      UI.showNotification('Đang tải SoundCloud...');
      
      // Use the permalink or api url for the widget
      const trackUrl = track.permalink || `https://api.soundcloud.com/tracks/${track.id}`;
      
      scWidget.load(trackUrl, {
        auto_play: true,
        show_artwork: false,
        buying: false,
        sharing: false,
        download: false,
        show_comments: false,
        show_playcount: false,
        show_user: false,
        hide_related: true,
        visual: false
      });

      // Volume sync
      const currentVolume = localStorage.getItem('volume') || 50;
      scWidget.setVolume(currentVolume);

    } catch (error) {
      console.error('SoundCloud widget error:', error);
      UI.showNotification('Lỗi phát SoundCloud: ' + error.message);
    }
  } else if (track.source === 'googledrive') {
    // Google Drive
    if (player) player.pause();
    if (scWidget) scWidget.pause();

    const html5Audio = document.getElementById('html5-audio-player');
    html5Audio.src = `/api/google-drive/stream/${track.id}`;
    html5Audio.volume = (localStorage.getItem('volume') || 50) / 100;
    
    html5Audio.play().catch(error => {
        console.error('HTML5 play error:', error);
        UI.showNotification('Lỗi phát Drive: ' + error.message);
    });

    html5Audio.onended = () => handleNext();
  } else if (track.isVOH) {
    // VOH Radio
    if (player) player.pause();
    if (scWidget) scWidget.pause();
    
    const html5Audio = document.getElementById('html5-audio-player');
    if (html5Audio) html5Audio.pause();

    UI.showNotification('Đang trích xuất link âm thanh VOH...');
    try {
        const res = await fetch(`/api/voh/audio?url=${encodeURIComponent(track.url)}`);
        const audioData = await res.json();
        if (audioData.success) {
            const html5AudioPlayer = document.getElementById('html5-audio-player');
            html5AudioPlayer.src = audioData.audioUrl;
            html5AudioPlayer.volume = (localStorage.getItem('volume') || 50) / 100;
            
            html5AudioPlayer.play().catch(error => {
                console.error('VOH play error:', error);
                UI.showNotification('Lỗi phát VOH: ' + error.message);
            });
            
            html5AudioPlayer.onended = () => handleNext();
        } else {
            throw new Error(audioData.error);
        }
    } catch (error) {
        console.error('VOH extraction error:', error);
        UI.showNotification('Lỗi trích xuất VOH: ' + error.message);
    }
  } else {
    // YouTube (Default)
    player.loadVideo(track.id);
    player.play();
  }
}

function stopHTML5Audio() {
  if (scWidget) scWidget.pause();
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
    playInternalTrack(track);
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
    playInternalTrack(track);
  } else {
    UI.showNotification('Đã phát hết danh sách');
    if (player) player.pause();
    if (scWidget) scWidget.pause();
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
    playInternalTrack(track);
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
  const percentage = e.target.value;
  const currentTrack = playlist.getCurrentTrack();
  
  if (currentTrack && currentTrack.source === 'soundcloud' && scWidget) {
    scWidget.getDuration((durationMs) => {
      if (durationMs > 0) {
        scWidget.seekTo((percentage / 100) * durationMs);
      }
    });
    return;
  }
  
  if (currentTrack && (currentTrack.source === 'googledrive' || currentTrack.isVOH)) {
    const html5Audio = document.getElementById('html5-audio-player');
    if (html5Audio && html5Audio.duration) {
      const seekTime = (percentage / 100) * html5Audio.duration;
      html5Audio.currentTime = seekTime;
    }
    return;
  }

  if (!player || !player.isReady) return;
  const duration = player.getDuration();
  if (duration > 0) {
    const seekTime = (percentage / 100) * duration;
    player.seekTo(seekTime);
  }
}

// Handle volume
function handleVolume(e) {
  const volume = e.target.value;

  if (player && player.isReady) {
    player.setVolume(volume);
  }
  
  if (scWidget) {
    scWidget.setVolume(volume);
  }

  const html5Audio = document.getElementById('html5-audio-player');
  if (html5Audio) {
    html5Audio.volume = volume / 100;
  }

  UI.updateVolumeIcon(volume);
  localStorage.setItem('volume', volume);
}

// Mute/unmute volume
function handleVolumeMute() {
  const currentTrack = playlist.getCurrentTrack();
  const html5Audio = document.getElementById('html5-audio-player');
  const isHtml5 = currentTrack && (currentTrack.source === 'googledrive' || currentTrack.isVOH);
  
  // Use HTML5 audio muted state or player muted state depending on the track
  const isMutedNow = isHtml5 
    ? (html5Audio && html5Audio.volume === 0) 
    : (player && player.isReady && player.isMuted());

  if (isMutedNow) {
    if (player) player.unmute();
    if (scWidget) scWidget.setVolume(localStorage.getItem('volume') || 50);
    
    const savedVolume = localStorage.getItem('volume') || 50;
    if (html5Audio) html5Audio.volume = savedVolume / 100;
    
    document.getElementById('volume-slider').value = savedVolume;
    UI.updateVolumeIcon(savedVolume);
  } else {
    if (player) player.mute();
    if (scWidget) scWidget.setVolume(0);
    if (html5Audio) html5Audio.volume = 0;
    
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
  } else if (viewName === 'mymusic') {
    loadMyMusic();
  } else if (viewName === 'voh') {
    loadVOH();
  }
}

// ==================== BULK ACTIONS ====================

function updateBulkDeleteButton(viewType) {
    const checkboxes = document.querySelectorAll('.' + viewType + '-checkbox');
    const checkedBoxes = document.querySelectorAll('.' + viewType + '-checkbox:checked');
    const deleteBtn = document.getElementById('delete-selected-' + viewType);
    const selectAll = document.getElementById('select-all-' + viewType);
    const countDisplay = deleteBtn ? deleteBtn.querySelector('.selected-count') : null;

    if (deleteBtn) {
        deleteBtn.disabled = checkedBoxes.length === 0;
        if (countDisplay) countDisplay.textContent = checkedBoxes.length;
    }

    if (selectAll) {
        selectAll.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
    }
}

// Event delegation for bulk actions
document.addEventListener('change', (e) => {
    const target = e.target;
    
    // Select All Queue
    if (target.id === 'select-all-queue') {
        const checkboxes = document.querySelectorAll('.queue-checkbox');
        checkboxes.forEach(cb => cb.checked = target.checked);
        updateBulkDeleteButton('queue');
    }

    // Select All Favorites
    if (target.id === 'select-all-favorites') {
        const checkboxes = document.querySelectorAll('.fav-checkbox');
        checkboxes.forEach(cb => cb.checked = target.checked);
        updateBulkDeleteButton('favorites');
    }

    // Individual Checkboxes
    if (target.classList.contains('queue-checkbox')) {
        updateBulkDeleteButton('queue');
    }
    
    if (target.classList.contains('fav-checkbox')) {
        updateBulkDeleteButton('favorites');
    }
});

document.addEventListener('click', async (e) => {
    const target = e.target;

    // Delete Selected Queue
    if (target.id === 'delete-selected-queue' || target.closest('#delete-selected-queue')) {
        const checkedBoxes = document.querySelectorAll('.queue-checkbox:checked');
        const indices = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.queueIndex));
        
        if (indices.length > 0) {
            if (confirm('Bạn có chắc chắn muốn xóa ' + indices.length + ' bài hát khỏi danh sách phát?')) {
                playlist.removeMultiple(indices);
                UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
                UI.showNotification('Đã xóa ' + indices.length + ' bài hát');
            }
        }
    }

    // Delete Selected Favorites
    if (target.id === 'delete-selected-favorites' || target.closest('#delete-selected-favorites')) {
        const checkedBoxes = document.querySelectorAll('.fav-checkbox:checked');
        const ids = Array.from(checkedBoxes).map(cb => cb.dataset.videoId);
        
        if (ids.length > 0) {
            if (confirm('Bạn có chắc chắn muốn xóa ' + ids.length + ' bài hát khỏi mục yêu thích?')) {
                try {
                    UI.showNotification('Đang xóa...');
                    await favorites.removeMultiple(ids);
                    favorites.renderFavorites();
                    UI.showNotification('Đã xóa ' + ids.length + ' bài hát thành công');
                } catch (error) {
                    UI.showNotification('Lỗi: ' + error.message);
                }
            }
        }
    }
});
