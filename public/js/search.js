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
        <div class="col-span-2 py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-6xl mb-4">search_off</span>
          <p>Không tìm thấy kết quả</p>
        </div>
      `;
      return;
    }

    const paginatedVideos = this.getPaginatedResults();
    const totalPages = this.getTotalPages();

    container.innerHTML = `
      <div class="col-span-2 mb-4 px-1">
        <span class="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
            Hiển thị ${(this.currentPage - 1) * this.itemsPerPage + 1}-${Math.min(this.currentPage * this.itemsPerPage, videos.length)} / ${videos.length} bài hát
        </span>
      </div>
      <div class="col-span-2 grid grid-cols-2 gap-4">
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

    let paginationHTML = '<div class="col-span-2 flex items-center justify-center gap-2 mt-8 mb-4">';

    // Previous button
    paginationHTML += `
      <button class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-primary hover:text-on-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              onclick="search.previousPage()"
              ${currentPage === 1 ? 'disabled' : ''}>
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
    `;

    // Page numbers
    paginationHTML += '<div class="flex items-center gap-1">';

    // Show nearby pages
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
        const isActive = i === currentPage;
        paginationHTML += `
            <button class="w-10 h-10 flex items-center justify-center rounded-full ${isActive ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'} transition-colors"
                onclick="search.goToPage(${i})">
                ${i}
            </button>
        `;
    }

    paginationHTML += '</div>';

    // Next button
    paginationHTML += `
      <button class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-primary hover:text-on-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              onclick="search.nextPage()"
              ${currentPage === totalPages ? 'disabled' : ''}>
        <span class="material-symbols-outlined">chevron_right</span>
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
