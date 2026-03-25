// UI update functions
const UI = {
  /**
   * Update now playing display
   */
  updateNowPlaying(video) {
    const thumb = document.getElementById('now-playing-thumb');
    const placeholder = document.getElementById('now-playing-placeholder');
    const title = document.getElementById('now-playing-title');
    const channel = document.getElementById('now-playing-channel');
    const favoriteBtn = document.getElementById('favorite-current-btn');

    if (video) {
      // Load thumbnail with fallback
      if (video.thumbnail) {
        thumb.src = video.thumbnail;
        thumb.classList.add('loaded');
        placeholder.classList.add('hidden');

        // Handle image load error
        thumb.onerror = function() {
          thumb.classList.remove('loaded');
          placeholder.classList.remove('hidden');
        };
      } else {
        thumb.classList.remove('loaded');
        placeholder.classList.remove('hidden');
      }

      title.textContent = video.title || 'Không có tiêu đề';
      channel.textContent = video.channel || '';
      favoriteBtn.style.display = 'block';
      favoriteBtn.dataset.videoId = video.id;
    } else {
      thumb.src = '';
      thumb.classList.remove('loaded');
      placeholder.classList.remove('hidden');
      title.textContent = 'Chưa phát bài nào';
      channel.textContent = '';
      favoriteBtn.style.display = 'none';
    }
  },

  /**
   * Update progress bar
   */
  updateProgressBar(currentTime, duration) {
    const progressBar = document.getElementById('progress-bar');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressBarFillMobile = document.getElementById('progress-bar-fill-mobile');
    const currentTimeLabel = document.getElementById('current-time');
    const durationLabel = document.getElementById('duration');

    if (duration > 0) {
      const percentage = (currentTime / duration) * 100;
      if (progressBar) progressBar.value = percentage;
      if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
      if (progressBarFillMobile) progressBarFillMobile.style.width = `${percentage}%`;
      if (currentTimeLabel) currentTimeLabel.textContent = this.formatTime(currentTime);
      if (durationLabel) durationLabel.textContent = this.formatTime(duration);
    } else {
      if (progressBar) progressBar.value = 0;
      if (progressBarFill) progressBarFill.style.width = '0%';
      if (progressBarFillMobile) progressBarFillMobile.style.width = '0%';
      if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
      if (durationLabel) durationLabel.textContent = '0:00';
    }
  },

  /**
   * Update play/pause button
   */
  updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause-btn');
    const icon = btn.querySelector('.material-symbols-outlined');
    const thumbContainer = document.getElementById('now-playing-thumb')?.parentElement;
    
    if (icon) {
      icon.textContent = isPlaying ? 'pause' : 'play_arrow';
    }
    
    if (thumbContainer) {
      if (isPlaying) {
        thumbContainer.classList.add('animate-spin-slow');
      } else {
        thumbContainer.classList.remove('animate-spin-slow');
      }
    }
    
    btn.title = isPlaying ? 'Tạm dừng' : 'Phát';
  },

  /**
   * Update shuffle button
   */
  updateShuffleButton(isActive) {
    const btn = document.getElementById('shuffle-btn');
    if (isActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  },

  /**
   * Update repeat button
   */
  updateRepeatButton(mode) {
    const btn = document.getElementById('repeat-btn');
    btn.dataset.mode = mode;

    switch (mode) {
      case 'one':
        btn.textContent = '🔂';
        btn.classList.add('active');
        btn.title = 'Lặp lại một bài';
        break;
      case 'all':
        btn.textContent = '🔁';
        btn.classList.add('active');
        btn.title = 'Lặp lại tất cả';
        break;
      default:
        btn.textContent = '🔁';
        btn.classList.remove('active');
        btn.title = 'Không lặp lại';
    }
  },

  /**
   * Update volume icon
   */
  updateVolumeIcon(volume) {
    const btn = document.getElementById('volume-btn');
    const volumeFill = document.getElementById('volume-fill');
    const volumeSlider = document.getElementById('volume-slider');

    if (volumeFill) volumeFill.style.width = `${volume}%`;
    if (volumeSlider) volumeSlider.value = volume;

    if (volume === 0) {
      btn.textContent = '🔇';
    } else if (volume < 30) {
      btn.textContent = '🔈';
    } else if (volume < 70) {
      btn.textContent = '🔉';
    } else {
      btn.textContent = '🔊';
    }
  },

  /**
   * Switch between views
   */
  switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
        link.classList.remove('text-on-surface/60');
        link.classList.add('text-primary');
      } else {
        link.classList.remove('active');
        link.classList.add('text-on-surface/60');
        link.classList.remove('text-primary');
      }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      if (view.id === `${viewName}-view` || view.id === `${viewName}-results`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Special case for search view components
    const searchView = document.getElementById('search-view');
    const heroSection = searchView?.querySelector('section.relative');
    const searchMobile = searchView?.querySelector('.sm\\:hidden');
    const trendingSection = document.getElementById('trending-section');
    const resultsSection = document.getElementById('search-results-container-section');
    
    if (viewName !== 'search') {
      if (heroSection) heroSection.classList.add('hidden');
      if (searchMobile) searchMobile.classList.add('hidden');
    } else {
      // Always keep hero hidden if we want it gone (already removed from HTML, but JS might still try to show it)
      if (heroSection) heroSection.classList.add('hidden');
      if (searchMobile) searchMobile.classList.remove('hidden');
      
      // Smart Toggle: If there's an active search result, hide trending. Else show trending.
      const hasResults = window.search && window.search.currentResults && window.search.currentResults.length > 0;
      const isCurrentlySearching = resultsSection && !resultsSection.classList.contains('hidden');

      if (hasResults && isCurrentlySearching) {
          if (trendingSection) trendingSection.classList.add('hidden');
          if (resultsSection) resultsSection.classList.remove('hidden');
      } else {
          if (trendingSection) trendingSection.classList.remove('hidden');
          if (resultsSection) resultsSection.classList.add('hidden');
      }
    }
  },

  /**
   * Show notification toast
   */
  showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  },

  /**
   * Format time in seconds to mm:ss
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Render queue
   */
  renderQueue(queue, currentIndex) {
    const container = document.getElementById('queue-container');
    if (!container) return;

    if (queue.length === 0) {
      container.innerHTML = `
        <div class="py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">queue_music</span>
          <p>Danh sách phát trống</p>
        </div>
      `;
      return;
    }

    container.innerHTML = queue.map((video, index) => {
      const isPlaying = index === currentIndex;
      return `
        <div class="flex items-center gap-4 bg-surface-container rounded-xl p-3 border ${isPlaying ? 'border-primary/50' : 'border-transparent'} group active:scale-[0.98] transition-all" data-queue-index="${index}">
          <div class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden relative">
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover">
            ${isPlaying ? '<div class="absolute inset-0 bg-primary/20 flex items-center justify-center"><div class="w-2 h-2 bg-primary rounded-full animate-ping"></div></div>' : ''}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-on-surface truncate">${video.title}</h4>
            <p class="text-primary text-xs font-semibold uppercase tracking-wider">${video.channel}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary btn-play-queue" data-queue-index="${index}">
              <span class="material-symbols-outlined">${isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error btn-remove-queue" data-queue-index="${index}">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render trending videos
   */
  renderTrending(videos) {
    const container = document.getElementById('trending-container');
    if (!container) return;

    if (!videos || videos.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">error</span>
          <p>Hiện tại không có bài hát hot nào</p>
        </div>
      `;
      return;
    }

    container.innerHTML = videos.map(video => {
      const escapedTitle = this.escapeHtml(video.title);
      return `
        <div class="space-y-3 group cursor-pointer" data-video-id="${video.id}">
          <div class="aspect-square rounded-xl overflow-hidden relative bg-surface-container-high shadow-lg btn-play" data-video-id="${video.id}">
            <img src="${video.thumbnail}" alt="${escapedTitle}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
            <div class="absolute inset-0 bg-black/40 opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-on-primary">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
              </div>
            </div>
            <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-[10px] font-bold text-white backdrop-blur-sm">${video.duration}</div>
          </div>
          <div class="px-1">
            <h4 class="font-bold text-on-surface leading-tight truncate btn-play" data-video-id="${video.id}">${video.title}</h4>
            <div class="flex justify-between items-center mt-1">
                <p class="text-on-surface-variant text-[11px] font-medium truncate flex-1 uppercase tracking-wider">${video.channel}</p>
                <div class="flex gap-1 ml-2">
                    <button class="p-1 text-on-surface-variant hover:text-primary btn-add-queue" data-video-id="${video.id}">
                        <span class="material-symbols-outlined text-sm">add</span>
                    </button>
                    <button class="p-1 text-on-surface-variant hover:text-primary btn-favorite" data-video-id="${video.id}">
                        <span class="material-symbols-outlined text-sm">favorite</span>
                    </button>
                </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render Google Drive music files
   */
  renderDriveMusic(files) {
    const container = document.getElementById('mymusic-container');
    if (!container) return;

    if (!files || files.length === 0) {
      container.innerHTML = `
        <div class="py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">folder_open</span>
          <p>Không tìm thấy file nhạc nào trên Google Drive.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = files.map(file => {
      const escapedTitle = this.escapeHtml(file.title);
      return `
        <div class="flex items-center gap-4 bg-surface-container rounded-xl p-3 border border-transparent hover:border-primary/30 group active:scale-[0.98] transition-all" data-video-id="${file.id}">
          <div class="w-12 h-12 flex-shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <span class="material-symbols-outlined">music_note</span>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-on-surface truncate">${file.title}</h4>
            <p class="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">Google Drive</p>
          </div>
          <div class="flex items-center gap-1">
            <button class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary btn-play-drive" data-file-id="${file.id}">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary btn-add-queue-drive" data-file-id="${file.id}">
              <span class="material-symbols-outlined">add</span>
            </button>
            <a href="/api/google-drive/stream/${file.id}?download=1" class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary" download>
              <span class="material-symbols-outlined">download</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Update favorite button state
   */
  updateFavoriteButtons(videoId, isFavorite) {
    document.querySelectorAll(`[data-video-id="${videoId}"] .btn-favorite, .btn-remove-favorite`).forEach(btn => {
      if (isFavorite) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },
  /**
   * Render VOH episodes
   */
  renderVOH(episodes) {
    const container = document.getElementById('voh-container');
    if (!container) return;

    if (!episodes || episodes.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">mail</span>
          <p>Hiện tại không có lá thư xanh nào</p>
        </div>
      `;
      return;
    }

    container.innerHTML = episodes.map(episode => {
      const escapedTitle = this.escapeHtml(episode.title);
      return `
        <div class="space-y-3 group cursor-pointer" data-voh-url="${episode.url}">
          <div class="aspect-square rounded-xl overflow-hidden relative bg-surface-container-high shadow-lg">
            <img src="${episode.thumbnail}" alt="${escapedTitle}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-on-primary btn-play-voh" data-voh-url="${episode.url}">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Lá thư xanh</span>
            </div>
          </div>
          <div class="px-1">
            <h4 class="font-bold text-on-surface leading-tight truncate btn-play-voh" data-voh-url="${episode.url}">${episode.title}</h4>
            <div class="flex justify-between items-center mt-1">
                <p class="text-on-surface-variant text-[11px] font-medium truncate flex-1 uppercase tracking-wider">${episode.channel}</p>
                <div class="flex gap-1 ml-2">
                    <button class="p-1 text-on-surface-variant hover:text-primary btn-add-queue-voh" data-voh-url="${episode.url}">
                        <span class="material-symbols-outlined text-sm">add</span>
                    </button>
                </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },
  /**
   * Update browser Media Session metadata
   */
  updateMediaMetadata(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.channel || 'YourMusic',
        album: 'YourMusic',
        artwork: [
          { src: track.thumbnail, sizes: '96x96', type: 'image/png' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/png' },
          { src: track.thumbnail, sizes: '192x192', type: 'image/png' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/png' },
          { src: track.thumbnail, sizes: '384x384', type: 'image/png' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/png' },
        ]
      });
    }
  },
  /**
   * Initialize Media Session action handlers
   */
  initMediaSession(handlers) {
    if ('mediaSession' in navigator) {
      const actions = [
        ['play', handlers.play],
        ['pause', handlers.pause],
        ['previoustrack', handlers.prev],
        ['nexttrack', handlers.next],
        ['seekbackward', (details) => handlers.seek && handlers.seek(Math.max((details.seekOffset || 10) * -1, 0))],
        ['seekforward', (details) => handlers.seek && handlers.seek(details.seekOffset || 10)],
        ['seekto', (details) => handlers.seekTo && handlers.seekTo(details.seekTime)]
      ];

      for (const [action, handler] of actions) {
        try {
          if (handler) {
            navigator.mediaSession.setActionHandler(action, handler);
          }
        } catch (error) {
          console.warn(`The media session action "${action}" is not supported yet.`);
        }
      }
    }
  }
};

// Export to global scope
window.UI = UI;
