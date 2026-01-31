// Favorites management
class Favorites {
  constructor() {
    this.favorites = [];
  }

  /**
   * Load favorites from API
   */
  async loadFavorites() {
    try {
      const response = await fetch('/api/favorites');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load favorites');
      }

      this.favorites = data.data || [];
      return this.favorites;
    } catch (error) {
      console.error('Error loading favorites:', error);
      throw error;
    }
  }

  /**
   * Add video to favorites
   */
  async addFavorite(video) {
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          channel: video.channel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Video đã có trong danh sách yêu thích');
        }
        throw new Error(data.error || 'Failed to add favorite');
      }

      this.favorites.push(data.data);
      return data.data;
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove video from favorites
   */
  async removeFavorite(videoId) {
    try {
      const response = await fetch(`/api/favorites/${videoId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove favorite');
      }

      this.favorites = this.favorites.filter(fav => fav.id !== videoId);
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Check if video is in favorites
   */
  isFavorite(videoId) {
    return this.favorites.some(fav => fav.id === videoId);
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(video) {
    if (this.isFavorite(video.id)) {
      await this.removeFavorite(video.id);
      return false;
    } else {
      await this.addFavorite(video);
      return true;
    }
  }

  /**
   * Render favorites to DOM
   */
  renderFavorites(containerSelector = '#favorites-container') {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    if (this.favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❤️</div>
          <p>Chưa có bài hát yêu thích</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.favorites.map(video => this.createFavoriteCard(video)).join('');
  }

  /**
   * Create HTML for a favorite card
   */
  createFavoriteCard(video) {
    return `
      <div class="video-card" data-video-id="${video.id}">
        <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
        <div class="video-info">
          <div class="video-title" title="${video.title}">${video.title}</div>
          <div class="video-channel">${video.channel}</div>
          <div class="video-actions">
            <button class="btn-icon btn-play" data-video-id="${video.id}" title="Phát ngay">
              ▶️
            </button>
            <button class="btn-icon btn-add-queue" data-video-id="${video.id}" title="Thêm vào danh sách phát">
              ➕
            </button>
            <button class="btn-icon btn-remove-favorite active" data-video-id="${video.id}" title="Xóa khỏi yêu thích">
              ❤️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get all favorites
   */
  getFavorites() {
    return this.favorites;
  }
}

// Export to global scope
window.Favorites = Favorites;
