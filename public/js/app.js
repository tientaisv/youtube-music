// Main application logic
let player;
let playlist;
let search;
let favorites;
let progressUpdateInterval;
let trendingVideos = []; // Store trending videos
let newReleasesVideos = []; // Store new releases videos
let currentHomeTab = 'hot'; // 'hot' or 'new'
let currentLyricsData = null; // Store current track lyrics
let vohEpisodes = []; // Store VOH episodes
let driveMusicFiles = []; // Store Drive music files
let scWidget = null;

// Setup event listeners IMMEDIATELY (don't wait for anything)
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM loaded, setting up event listeners...');

  // Initialize modules that don't need YouTube API
  playlist = new Playlist();
  window.search = new Search(); // Make search globally accessible
  search = window.search;
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

  // Check for shared links
  checkInitialShareLink();
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
    const setupVol = () => {
      const vol = localStorage.getItem('volume') || 50;
      const volumeSlider = document.getElementById('volume-slider'); // Define volumeSlider here
      if (volumeSlider) volumeSlider.value = vol;
      if (player && player.isReady) player.setVolume(vol);
      UI.updateVolumeIcon(vol);
    };
    setupVol();

    // Initialize Media Session API
    UI.initMediaSession({
      play: () => handlePlayPause(),
      pause: () => handlePlayPause(),
      next: () => handleNext(),
      prev: () => handlePrevious(), // Changed from handlePrev to handlePrevious to match existing function
      seek: (offset) => {
        if (player && player.isReady) {
          const currentTime = player.getCurrentTime();
          player.seekTo(currentTime + offset);
        }
      }
    });

    console.log('✅ YouTube player ready!'); // Reverted to original log message
    UI.showNotification('Player đã sẵn sàng!', 2000);
  } catch (error) {
    console.error('⚠️ YouTube player failed to initialize:', error);
    UI.showNotification('Player initialization failed, but app still works!');
  }
}

// Helper function for debouncing input calls
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Set up search suggestions for an input element
function setupAutocomplete(inputEl, suggestionsElSelector) {
  if (!inputEl) return;

  const suggestionsEl = document.querySelector(suggestionsElSelector);
  let selectedIndex = -1;
  let currentSuggestions = [];

  const hideSuggestions = () => {
    setTimeout(() => {
      if (suggestionsEl) suggestionsEl.classList.add('hidden');
      selectedIndex = -1;
    }, 200); // 200ms delay to allow click event to register
  };

  // Debounced fetch & render
  const handleInput = debounce(async () => {
    const query = inputEl.value.trim();
    if (!query) {
      if (suggestionsEl) suggestionsEl.classList.add('hidden');
      currentSuggestions = [];
      selectedIndex = -1;
      return;
    }

    currentSuggestions = await search.getSuggestions(query);
    selectedIndex = -1;
    
    search.renderSuggestions(currentSuggestions, suggestionsElSelector, (value) => {
      inputEl.value = value;
      handleSearch();
      if (suggestionsEl) suggestionsEl.classList.add('hidden');
    });
  }, 250);

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('blur', hideSuggestions);
  inputEl.addEventListener('focus', () => {
    const query = inputEl.value.trim();
    if (query && currentSuggestions.length > 0) {
      if (suggestionsEl) suggestionsEl.classList.remove('hidden');
    }
  });

  // Keyboard navigation
  inputEl.addEventListener('keydown', (e) => {
    if (!suggestionsEl || suggestionsEl.classList.contains('hidden')) return;

    const items = suggestionsEl.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        const selectedValue = items[selectedIndex].dataset.value;
        inputEl.value = selectedValue;
        handleSearch();
        suggestionsEl.classList.add('hidden');
      }
    } else if (e.key === 'Escape') {
      suggestionsEl.classList.add('hidden');
      inputEl.blur();
    }
  });

  const updateSelection = (items) => {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('bg-primary/20', 'text-primary');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('bg-primary/20', 'text-primary');
      }
    });
  };
}

// Setup all event listeners
function setupEventListeners() {
  // Search
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtnMobile = document.getElementById('search-btn-mobile');
  const searchInputMobile = document.getElementById('search-input-mobile');

  const addSearchListeners = (btn, input) => {
    if (btn) btn.addEventListener('click', handleSearch);
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
      });
    }
  };

  addSearchListeners(searchBtn, searchInput);
  addSearchListeners(searchBtnMobile, searchInputMobile);
  setupAutocomplete(searchInput, '#search-suggestions');
  setupAutocomplete(searchInputMobile, '#search-suggestions-mobile');

  // Trending/New Releases Refresh
  const refreshBtn = document.getElementById('trending-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (currentHomeTab === 'hot') {
        loadTrending(true); // Force refresh
      } else {
        loadNewReleases(true); // Force refresh
      }
    });
  }

  // Home Tabs
  const tabHot = document.getElementById('tab-hot');
  const tabNew = document.getElementById('tab-new');
  if (tabHot && tabNew) {
    tabHot.addEventListener('click', () => {
      if (currentHomeTab === 'hot') return;
      currentHomeTab = 'hot';
      tabHot.className = 'font-headline font-bold text-2xl text-primary border-b-2 border-primary pb-2 focus:outline-none transition-all duration-300';
      tabNew.className = 'font-headline font-bold text-2xl text-on-surface/60 hover:text-on-surface pb-2 focus:outline-none transition-all duration-300';
      loadTrending();
    });

    tabNew.addEventListener('click', () => {
      if (currentHomeTab === 'new') return;
      currentHomeTab = 'new';
      tabNew.className = 'font-headline font-bold text-2xl text-primary border-b-2 border-primary pb-2 focus:outline-none transition-all duration-300';
      tabHot.className = 'font-headline font-bold text-2xl text-on-surface/60 hover:text-on-surface pb-2 focus:outline-none transition-all duration-300';
      loadNewReleases();
    });
  }

  // Download current track
  const downloadCurrentBtn = document.getElementById('download-current-btn');
  if (downloadCurrentBtn) {
    downloadCurrentBtn.addEventListener('click', () => {
      const track = playlist.getCurrentTrack();
      if (!track) {
        UI.showNotification('Chưa có bài hát nào đang phát');
        return;
      }
      handleDownloadTrack(track.id, track.title);
    });
  }

  // Lyrics modal open/close/tabs
  const lyricsModal = document.getElementById('lyrics-modal');
  const showLyricsBtn = document.getElementById('show-lyrics-btn');
  const closeLyricsBtn = document.getElementById('close-lyrics-btn');
  const retryLyricsBtn = document.getElementById('retry-lyrics-btn');
  const tabOriginal = document.getElementById('lyrics-tab-original');
  const tabTranslation = document.getElementById('lyrics-tab-translation');
  const lyricsText = document.getElementById('lyrics-text');

  if (showLyricsBtn && lyricsModal) {
    showLyricsBtn.addEventListener('click', () => {
      const track = playlist.getCurrentTrack();
      if (!track) {
        UI.showNotification('Chưa có bài hát nào đang phát');
        return;
      }
      
      // Open modal
      lyricsModal.classList.remove('hidden');
      setTimeout(() => {
        lyricsModal.classList.remove('opacity-0');
        lyricsModal.querySelector('.bg-surface-dim').classList.remove('scale-95');
      }, 50);

      fetchLyrics(track.title, track.channel);
    });
  }

  const closeLyrics = () => {
    if (lyricsModal) {
      lyricsModal.classList.add('opacity-0');
      lyricsModal.querySelector('.bg-surface-dim').classList.add('scale-95');
      setTimeout(() => {
        lyricsModal.classList.add('hidden');
      }, 300);
    }
  };

  if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', closeLyrics);
  if (lyricsModal) {
    lyricsModal.addEventListener('click', (e) => {
      if (e.target === lyricsModal) closeLyrics();
    });
  }
  
  if (retryLyricsBtn) {
    retryLyricsBtn.addEventListener('click', () => {
      const track = playlist.getCurrentTrack();
      if (track) {
        fetchLyrics(track.title, track.channel);
      }
    });
  }

  if (tabOriginal) {
    tabOriginal.addEventListener('click', () => {
      tabOriginal.className = 'px-4 py-3 text-sm font-bold text-primary border-b-2 border-primary focus:outline-none transition-all duration-200';
      tabTranslation.className = 'px-4 py-3 text-sm font-bold text-on-surface/60 hover:text-on-surface focus:outline-none transition-all duration-200';
      if (currentLyricsData) {
        lyricsText.textContent = currentLyricsData.lyrics;
      }
    });
  }

  if (tabTranslation) {
    tabTranslation.addEventListener('click', () => {
      tabTranslation.className = 'px-4 py-3 text-sm font-bold text-primary border-b-2 border-primary focus:outline-none transition-all duration-200';
      tabOriginal.className = 'px-4 py-3 text-sm font-bold text-on-surface/60 hover:text-on-surface focus:outline-none transition-all duration-200';
      if (currentLyricsData) {
        lyricsText.textContent = currentLyricsData.translation;
      }
    });
  }

  // Clear Search / Back button
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      const input = document.getElementById('search-input');
      const inputMobile = document.getElementById('search-input-mobile');
      if (input) input.value = '';
      if (inputMobile) inputMobile.value = '';
      
      if (window.search) window.search.currentResults = [];
      
      const trendingSection = document.getElementById('trending-section');
      const resultsSection = document.getElementById('search-results-container-section');
      if (trendingSection) trendingSection.classList.remove('hidden');
      if (resultsSection) resultsSection.classList.add('hidden');
      
      UI.switchView('search');
    });
  }

  // Player controls
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      handlePlayPause();
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
  const input = document.getElementById('search-input');
  const inputMobile = document.getElementById('search-input-mobile');
  const query = (input?.value || inputMobile?.value || '').trim();

  if (!query) {
    UI.showNotification('Vui lòng nhập từ khóa tìm kiếm');
    return;
  }

  try {
    UI.showNotification('Đang tìm kiếm...');
    console.log('Searching for:', query);

    const resultsSection = document.getElementById('search-results-container-section');
    if (resultsSection) resultsSection.classList.remove('hidden');

    const trendingSection = document.getElementById('trending-section');
    if (trendingSection) trendingSection.classList.add('hidden');

    const resultsContainer = document.getElementById('search-results-container');
    const loadingSpinner = document.getElementById('search-loading');
    
    // Show loading, hide old results
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');

    const results = await search.performSearch(query);
    console.log('Search results:', results.length);

    // Hide loading
    if (loadingSpinner) loadingSpinner.classList.add('hidden');

    const searchView = document.getElementById('search-view');
    const heroSection = searchView?.querySelector('section.relative');
    if (heroSection) heroSection.classList.add('hidden');

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
  return trendingVideos.find(v => v.id === id) || newReleasesVideos.find(v => v.id === id);
}

// ==================== NEW RELEASES (BÀI HÁT MỚI) ====================

async function loadNewReleases(force = false) {
  if (newReleasesVideos.length > 0 && !force) {
    UI.renderTrending(newReleasesVideos);
    return;
  }

  console.log('🆕 [New Releases] Loading started...');
  const container = document.getElementById('trending-container');
  if (container) {
    container.innerHTML = '<div class="trending-loading"><div class="loading"></div><p>Đang tải bài hát mới...</p></div>';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch('/api/new-releases', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const data = await response.json();

    if (data.success) {
      console.log(`✅ [New Releases] Loaded ${data.data.length} videos`);
      newReleasesVideos = data.data;
      UI.renderTrending(newReleasesVideos);
    } else {
      throw new Error(data.error || 'API returned success: false');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout ? 'Yêu cầu quá hạn (timeout 15s). Vui lòng kiểm tra kết nối mạng.' : error.message;
    
    console.error('❌ [New Releases] Failed:', error);
    
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>Không thể tải bài hát mới. ${errorMsg}</p>
          <button onclick="loadNewReleases(true)" class="pagination-btn" style="margin-top:10px;">Thử lại</button>
        </div>
      `;
    }
    UI.showNotification('Lỗi tải bài hát mới: ' + (isTimeout ? 'Timeout' : error.message));
  }
}

// ==================== LYRICS (LỜI BÀI HÁT) ====================

async function fetchLyrics(title, artist) {
  const lyricsLoading = document.getElementById('lyrics-loading');
  const lyricsError = document.getElementById('lyrics-error');
  const lyricsContainer = document.getElementById('lyrics-content-container');
  const lyricsText = document.getElementById('lyrics-text');
  const tabTranslation = document.getElementById('lyrics-tab-translation');
  const tabOriginal = document.getElementById('lyrics-tab-original');
  const songInfo = document.getElementById('lyrics-song-info');

  if (songInfo) songInfo.textContent = `${title} • ${artist}`;

  // Show loading
  if (lyricsLoading) lyricsLoading.classList.remove('hidden');
  if (lyricsError) lyricsError.classList.add('hidden');
  if (lyricsContainer) lyricsContainer.classList.add('hidden');
  if (tabTranslation) tabTranslation.classList.add('hidden');
  
  // Reset active tab to original
  if (tabOriginal) {
    tabOriginal.className = 'px-4 py-3 text-sm font-bold text-primary border-b-2 border-primary focus:outline-none transition-all duration-200';
  }
  if (tabTranslation) {
    tabTranslation.className = 'px-4 py-3 text-sm font-bold text-on-surface/60 hover:text-on-surface focus:outline-none transition-all duration-200';
  }

  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    const data = await res.json();
    
    if (data.success && data.data) {
      currentLyricsData = data.data;
      
      if (lyricsLoading) lyricsLoading.classList.add('hidden');
      if (lyricsContainer) lyricsContainer.classList.remove('hidden');
      
      // Render original lyrics
      if (lyricsText) lyricsText.textContent = currentLyricsData.lyrics || 'Không có dữ liệu lời bài hát.';
      
      // Show translation tab if translation exists and is not empty
      if (currentLyricsData.translation && currentLyricsData.translation.trim() !== '') {
        if (tabTranslation) tabTranslation.classList.remove('hidden');
      }
    } else {
      throw new Error(data.error || 'Failed to fetch lyrics');
    }
  } catch (error) {
    console.error('Lyrics fetch error:', error);
    if (lyricsLoading) lyricsLoading.classList.add('hidden');
    if (lyricsError) lyricsError.classList.remove('hidden');
    const errMsgEl = document.getElementById('lyrics-error-message');
    if (errMsgEl) errMsgEl.textContent = `Lỗi: ${error.message}`;
  }
}

// ==================== SOUNDCLOUD (SÁNG TÁC CỦA TÔI) ====================

async function loadMyMusic() {
  console.log('Loading music from Google Drive...');
  const container = document.getElementById('mymusic-container');
  if (container) {
    container.innerHTML = `
      <div class="py-20 flex flex-col items-center justify-center text-on-surface-variant">
        <div class="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p>Đang tải bộ sưu tập của bạn...</p>
      </div>
    `;
  }
  
  try {
    const response = await fetch('/api/google-drive/files');
    const data = await response.json();
    if (data.success) {
      driveMusicFiles = data.data; // Store for quick access
      UI.renderDriveMusic(data.data);
    } else {
      throw new Error(data.error || 'Failed to fetch files');
    }
  } catch (error) {
    console.error('Failed to load My Music:', error);
    UI.showNotification('Lỗi tải nhạc từ Drive: ' + error.message);
    if (container) {
      container.innerHTML = `
        <div class="py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4 text-error">error</span>
          <p>Không thể tải nhạc: ${error.message}</p>
          <button onclick="loadMyMusic()" class="mt-4 px-6 py-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all">Thử lại</button>
        </div>
      `;
    }
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
  const playBtn = target.closest('.btn-play');
  if (playBtn) {
    const videoId = playBtn.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
        handlePlayVideo(video);
        return;
    }
  }

  // Add to queue button
  const addQueueBtn = target.closest('.btn-add-queue');
  if (addQueueBtn) {
    const videoId = addQueueBtn.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
        handleAddToQueue(video);
        return;
    }
  }

  // Favorite button
  const favBtn = target.closest('.btn-favorite');
  if (favBtn) {
    const videoId = favBtn.dataset.videoId;
    let video = getTrendingVideoById(videoId) || search.getVideoById(videoId) || favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
        handleToggleFavorite(video);
        return;
    }
  }

  // Remove favorite button
  const removeFavBtn = target.closest('.btn-remove-favorite');
  if (removeFavBtn) {
    const videoId = removeFavBtn.dataset.videoId;
    const video = favorites.getFavorites().find(v => v.id === videoId);
    if (video) {
        handleToggleFavorite(video);
        return;
    }
  }

  // Download button
  const downloadBtn = target.closest('.btn-download');
  if (downloadBtn) {
    const videoId = downloadBtn.dataset.videoId;
    const title = downloadBtn.dataset.videoTitle || '';
    handleDownloadTrack(videoId, title);
    return;
  }

  // Play from queue
  const playQueueBtn = target.closest('.btn-play-queue');
  if (playQueueBtn) {
    const index = parseInt(playQueueBtn.dataset.queueIndex);
    handlePlayFromQueue(index);
    return;
  }

  // Remove from queue
  const removeQueueBtn = target.closest('.btn-remove-queue');
  if (removeQueueBtn) {
    const index = parseInt(removeQueueBtn.dataset.queueIndex);
    handleRemoveFromQueue(index);
    return;
  }

  // Google Drive play
  const playDriveBtn = target.closest('.btn-play-drive');
  if (playDriveBtn) {
    const fileId = playDriveBtn.dataset.fileId;
    UI.showNotification('Đang tải bài hát từ Drive...');
    
    // Check if we already have the file data in memory
    const existingFile = driveMusicFiles.find(f => f.id === fileId);
    if (existingFile) {
        handlePlayVideo(existingFile);
    } else {
        // Fallback to fetch if not found
        fetch(`/api/google-drive/files`).then(res => res.json()).then(data => {
          if (data.success) {
              driveMusicFiles = data.data;
              const file = data.data.find(f => f.id === fileId);
              if (file) handlePlayVideo(file);
          }
        }).catch(err => {
            UI.showNotification('Lỗi khi tải bài hát: ' + err.message);
        });
    }
    return;
  }

  // Google Drive add to queue
  const addQueueDriveBtn = target.closest('.btn-add-queue-drive');
  if (addQueueDriveBtn) {
    const fileId = addQueueDriveBtn.dataset.fileId;
    UI.showNotification('Đang thêm vào hàng chờ...');
    
    const existingFile = driveMusicFiles.find(f => f.id === fileId);
    if (existingFile) {
        handleAddToQueue(existingFile);
    } else {
        fetch(`/api/google-drive/files`).then(res => res.json()).then(data => {
          if (data.success) {
              driveMusicFiles = data.data;
              const file = data.data.find(f => f.id === fileId);
              if (file) handleAddToQueue(file);
          }
        });
    }
    return;
  }

  // VOH play
  const playVohBtn = target.closest('.btn-play-voh');
  if (playVohBtn) {
    const url = playVohBtn.dataset.vohUrl;
    const track = getVOHTrackByUrl(url);
    if (track) handlePlayVideo(track);
    return;
  }

  // VOH add to queue
  const addQueueVohBtn = target.closest('.btn-add-queue-voh');
  if (addQueueVohBtn) {
    const url = addQueueVohBtn.dataset.vohUrl;
    const track = getVOHTrackByUrl(url);
    if (track) handleAddToQueue(track);
    return;
  }

  // Google Drive share
  const shareDriveBtn = target.closest('.btn-share-drive');
  if (shareDriveBtn) {
    const fileId = shareDriveBtn.dataset.fileId;
    const shareUrl = `${window.location.origin}${window.location.pathname}?play=${fileId}&source=googledrive`;
    
    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            UI.showTooltip(shareDriveBtn, 'Đã copy');
            UI.showNotification('Đã sao chép link chia sẻ vào bộ nhớ tạm!');
        }).catch(err => {
            console.error('Failed to copy share link:', err);
            UI.showNotification('Không thể sao chép link: ' + err.message);
        });
    } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            UI.showTooltip(shareDriveBtn, 'Đã copy');
            UI.showNotification('Đã sao chép link chia sẻ!');
        } catch (err) {
            UI.showNotification('Không thể sao chép link');
        }
        document.body.removeChild(textArea);
    }
    return;
  }
}

// Download a track as MP3
function handleDownloadTrack(videoId, title) {
  UI.showNotification('Đang chuẩn bị luồng tải nhạc MP3...');
  const url = `/api/download/${videoId}?title=${encodeURIComponent(title)}`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  // Stop all other players first to prevent simultaneous playback
  stopAllPlayers();
  
  UI.updateNowPlaying(track);
  UI.updateMediaMetadata(track);
  UI.renderQueue(playlist.getQueue(), playlist.currentIndex);
  UI.showNotification('Đang phát: ' + track.title);

  if (track.source === 'soundcloud') {
    // SoundCloud
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

function stopAllPlayers() {
  // Pause YouTube
  if (player && player.isReady) {
    player.pause();
  }
  
  // Pause SoundCloud
  if (scWidget) {
    try {
      scWidget.pause();
    } catch (e) {
      console.warn("SoundCloud pause failed:", e);
    }
  }
  
  // Pause HTML5 Audio (Google Drive, VOH)
  const html5Audio = document.getElementById('html5-audio-player');
  if (html5Audio) {
    html5Audio.pause();
    html5Audio.src = ""; // Clear source to stop buffering
    html5Audio.load();
  }
}

// Play/Pause handling
function handlePlayPause() {
  const currentTrack = playlist.getCurrentTrack();
  
  // Handle SoundCloud Widget
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
  if (currentTrack && (currentTrack.source === 'googledrive' || currentTrack.isVOH)) {
    const html5Audio = document.getElementById('html5-audio-player');
    if (html5Audio) {
      if (html5Audio.paused) {
        html5Audio.play();
      } else {
        html5Audio.pause();
      }
    }
    return;
  }

  // Handle YouTube Player
  if (player && player.isReady) {
    player.togglePlayPause();
  } else {
    UI.showNotification('Player đang khởi tạo, vui lòng đợi...');
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

// Check for shared link parameters
async function checkInitialShareLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const playId = urlParams.get('play');
  const source = urlParams.get('source');

  if (playId && source === 'googledrive') {
    UI.showNotification('Đang tải bài hát được chia sẻ...');
    try {
      const response = await fetch(`/api/google-drive/file/${playId}`);
      const data = await response.json();
      if (data.success) {
        // Wait for player to be ready
        const checkPlayer = setInterval(() => {
          if (player && player.isReady) {
            handlePlayVideo(data.data);
            clearInterval(checkPlayer);
            // Clear URL params without reloading
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
        
        // Timeout after 15s
        setTimeout(() => clearInterval(checkPlayer), 15000);
      }
    } catch (error) {
      console.error('Failed to load shared track:', error);
      UI.showNotification('Không thể tải bài hát được chia sẻ');
    }
  }
}
