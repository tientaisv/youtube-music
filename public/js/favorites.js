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
   * Bulk remove videos from favorites
   */
  async removeMultiple(videoIds) {
    try {
      const response = await fetch('/api/favorites/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: videoIds })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bulk remove favorites');
      }

      this.favorites = this.favorites.filter(fav => !videoIds.includes(fav.id));
      return true;
    } catch (error) {
      console.error('Error bulk removing favorites:', error);
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
        <div class="col-span-2 py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">favorite</span>
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
    const escapedTitle = video.title.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    return `
      <div class="space-y-3 group cursor-pointer" data-video-id="${video.id}">
        <div class="aspect-square rounded-xl overflow-hidden relative bg-surface-container-high shadow-lg">
          <img src="${video.thumbnail}" alt="${escapedTitle}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-on-primary btn-play" data-video-id="${video.id}">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
            </div>
          </div>
        </div>
        <div class="px-1">
          <h4 class="font-bold text-on-surface leading-tight truncate btn-play" data-video-id="${video.id}">${video.title}</h4>
          <div class="flex justify-between items-center mt-1">
              <p class="text-on-surface-variant text-[11px] font-medium truncate flex-1 uppercase tracking-wider">${video.channel}</p>
              <div class="flex gap-1 ml-2">
                  <button class="p-1 text-on-surface-variant hover:text-primary btn-add-queue" data-video-id="${video.id}">
                      <span class="material-symbols-outlined text-sm">add</span>
                  </button>
                  <button class="p-1 text-primary btn-remove-favorite active" data-video-id="${video.id}">
                      <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">favorite</span>
                  </button>
                  <button class="p-1 text-on-surface-variant hover:text-primary btn-download" data-video-id="${video.id}" data-video-title="${escapedTitle}">
                      <span class="material-symbols-outlined text-sm">download</span>
                  </button>
              </div>
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
