// Search functionality
class Search {
  constructor() {
    this.currentResults = [];
  }

  /**
   * Perform search via API
   */
  async performSearch(query, maxResults = 20) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&max=${maxResults}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      this.currentResults = data.data || [];
      return this.currentResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Render search results to DOM
   */
  renderResults(videos, containerSelector = '#search-results-container') {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    if (videos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>Không tìm thấy kết quả</p>
        </div>
      `;
      return;
    }

    container.innerHTML = videos.map(video => this.createVideoCard(video)).join('');
  }

  /**
   * Create HTML for a video card
   */
  createVideoCard(video) {
    return `
      <div class="video-card" data-video-id="${video.id}">
        <div style="position: relative;">
          <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
          <span class="video-duration">${video.duration}</span>
        </div>
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
            <button class="btn-icon btn-favorite" data-video-id="${video.id}" title="Thêm vào yêu thích">
              ❤️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get video by ID from current results
   */
  getVideoById(videoId) {
    return this.currentResults.find(v => v.id === videoId);
  }
}

// Export to global scope
window.Search = Search;
