// Search functionality
class Search {
  constructor() {
    this.currentResults = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
  }

  /**
   * Perform search via API
   */
  async performSearch(query, maxResults = 100) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&max=${maxResults}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      this.currentResults = data.data || [];
      this.currentPage = 1; // Reset to first page on new search
      return this.currentResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get paginated results
   */
  getPaginatedResults() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.currentResults.slice(startIndex, endIndex);
  }

  /**
   * Get total pages
   */
  getTotalPages() {
    return Math.ceil(this.currentResults.length / this.itemsPerPage);
  }

  /**
   * Go to specific page
   */
  goToPage(pageNumber) {
    const totalPages = this.getTotalPages();
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      this.currentPage = pageNumber;
      this.renderResults(this.currentResults);
    }
  }

  /**
   * Next page
   */
  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * Previous page
   */
  previousPage() {
    this.goToPage(this.currentPage - 1);
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

    const paginatedVideos = this.getPaginatedResults();
    const totalPages = this.getTotalPages();

    container.innerHTML = `
      <div class="pagination-info">
        <span>Hiển thị ${(this.currentPage - 1) * this.itemsPerPage + 1}-${Math.min(this.currentPage * this.itemsPerPage, videos.length)} trong ${videos.length} kết quả</span>
      </div>
      <div class="video-grid">
        ${paginatedVideos.map(video => this.createVideoCard(video)).join('')}
      </div>
      ${totalPages > 1 ? this.createPagination() : ''}
    `;

    // Scroll to top of results
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Create pagination HTML
   */
  createPagination() {
    const totalPages = this.getTotalPages();
    const currentPage = this.currentPage;

    let paginationHTML = '<div class="pagination">';

    // Previous button
    paginationHTML += `
      <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
              onclick="search.previousPage()"
              ${currentPage === 1 ? 'disabled' : ''}>
        ⬅️ Trước
      </button>
    `;

    // Page numbers
    paginationHTML += '<div class="pagination-pages">';

    // Show first page
    if (currentPage > 3) {
      paginationHTML += `<button class="pagination-number" onclick="search.goToPage(1)">1</button>`;
      if (currentPage > 4) {
        paginationHTML += '<span class="pagination-dots">...</span>';
      }
    }

    // Show nearby pages
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      paginationHTML += `
        <button class="pagination-number ${i === currentPage ? 'active' : ''}"
                onclick="search.goToPage(${i})">
          ${i}
        </button>
      `;
    }

    // Show last page
    if (currentPage < totalPages - 2) {
      if (currentPage < totalPages - 3) {
        paginationHTML += '<span class="pagination-dots">...</span>';
      }
      paginationHTML += `<button class="pagination-number" onclick="search.goToPage(${totalPages})">${totalPages}</button>`;
    }

    paginationHTML += '</div>';

    // Next button
    paginationHTML += `
      <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
              onclick="search.nextPage()"
              ${currentPage === totalPages ? 'disabled' : ''}>
        Sau ➡️
      </button>
    `;

    paginationHTML += '</div>';
    return paginationHTML;
  }

  /**
   * Create HTML for a video card
   */
  createVideoCard(video) {
    const escapedTitle = video.title.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    return `
      <div class="video-card" data-video-id="${video.id}">
        <div style="position: relative;">
          <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" onerror="this.style.display='none'">
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
            <button class="btn-icon btn-download" data-video-id="${video.id}" data-video-title="${escapedTitle}" title="Tải xuống">
              ⬇️
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
