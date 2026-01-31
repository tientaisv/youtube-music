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
    const downloadBtn = document.getElementById('download-current-btn');

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
      downloadBtn.style.display = 'block';
      downloadBtn.dataset.videoId = video.id;
    } else {
      thumb.src = '';
      thumb.classList.remove('loaded');
      placeholder.classList.remove('hidden');
      title.textContent = 'Chưa phát bài nào';
      channel.textContent = '';
      favoriteBtn.style.display = 'none';
      downloadBtn.style.display = 'none';
    }
  },

  /**
   * Update progress bar
   */
  updateProgressBar(currentTime, duration) {
    const progressBar = document.getElementById('progress-bar');
    const currentTimeLabel = document.getElementById('current-time');
    const durationLabel = document.getElementById('duration');

    if (duration > 0) {
      const percentage = (currentTime / duration) * 100;
      progressBar.value = percentage;
      currentTimeLabel.textContent = this.formatTime(currentTime);
      durationLabel.textContent = this.formatTime(duration);
    } else {
      progressBar.value = 0;
      currentTimeLabel.textContent = '0:00';
      durationLabel.textContent = '0:00';
    }
  },

  /**
   * Update play/pause button
   */
  updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause-btn');
    btn.textContent = isPlaying ? '⏸️' : '▶️';
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
      } else {
        link.classList.remove('active');
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
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Danh sách phát trống</p>
        </div>
      `;
      return;
    }

    container.innerHTML = queue.map((video, index) => {
      const isPlaying = index === currentIndex;
      return `
        <div class="video-card ${isPlaying ? 'playing' : ''}" data-queue-index="${index}">
          <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" onerror="this.style.display='none'">
          <div class="video-info">
            <div class="video-title" title="${video.title}">${video.title}</div>
            <div class="video-channel">${video.channel}</div>
            <div class="video-actions">
              <button class="btn-icon btn-play-queue" data-queue-index="${index}" title="Phát">
                ${isPlaying ? '⏸️' : '▶️'}
              </button>
              <button class="btn-icon btn-download-queue" data-video-id="${video.id}" data-video-title="${this.escapeHtml(video.title)}" title="Tải xuống">
                ⬇️
              </button>
              <button class="btn-icon btn-remove-queue" data-queue-index="${index}" title="Xóa khỏi danh sách">
                🗑️
              </button>
            </div>
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
  }
};

// Export to global scope
window.UI = UI;
