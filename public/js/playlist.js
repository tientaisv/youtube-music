// Playlist/Queue Management
class Playlist {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.shuffleMode = false;
    this.repeatMode = 'off'; // 'off', 'one', 'all'
    this.originalQueue = [];
    this.loadFromLocalStorage();
  }

  /**
   * Add a video to the queue
   */
  add(video) {
    this.queue.push(video);
    this.saveToLocalStorage();
  }

  /**
   * Remove a video from the queue
   */
  remove(index) {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      if (this.currentIndex >= index) {
        this.currentIndex--;
      }
      this.saveToLocalStorage();
    }
  }

  /**
   * Clear the entire queue
   */
  clear() {
    this.queue = [];
    this.currentIndex = -1;
    this.saveToLocalStorage();
  }

  /**
   * Play video at specific index
   */
  playAt(index) {
    if (index >= 0 && index < this.queue.length) {
      this.currentIndex = index;
      this.saveToLocalStorage();
      return this.queue[index];
    }
    return null;
  }

  /**
   * Get next track
   */
  next() {
    if (this.queue.length === 0) return null;

    // Repeat one
    if (this.repeatMode === 'one') {
      return this.queue[this.currentIndex];
    }

    // Shuffle mode
    if (this.shuffleMode) {
      const randomIndex = Math.floor(Math.random() * this.queue.length);
      this.currentIndex = randomIndex;
    } else {
      this.currentIndex++;

      // Repeat all or stop at end
      if (this.currentIndex >= this.queue.length) {
        if (this.repeatMode === 'all') {
          this.currentIndex = 0;
        } else {
          this.currentIndex = this.queue.length - 1;
          return null;
        }
      }
    }

    this.saveToLocalStorage();
    return this.queue[this.currentIndex];
  }

  /**
   * Get previous track
   */
  previous() {
    if (this.queue.length === 0) return null;

    this.currentIndex--;
    if (this.currentIndex < 0) {
      this.currentIndex = this.repeatMode === 'all' ? this.queue.length - 1 : 0;
    }

    this.saveToLocalStorage();
    return this.queue[this.currentIndex];
  }

  /**
   * Toggle shuffle mode
   */
  toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;

    if (this.shuffleMode) {
      // Save original order
      this.originalQueue = [...this.queue];
    } else {
      // Restore original order if exists
      if (this.originalQueue.length > 0) {
        const currentVideo = this.queue[this.currentIndex];
        this.queue = [...this.originalQueue];
        // Find current video in restored queue
        this.currentIndex = this.queue.findIndex(v => v.id === (currentVideo ? currentVideo.id : null));
        if (this.currentIndex === -1) this.currentIndex = 0;
        this.originalQueue = [];
      }
    }

    this.saveToLocalStorage();
    return this.shuffleMode;
  }

  /**
   * Cycle through repeat modes: off -> all -> one -> off
   */
  cycleRepeatMode() {
    const modes = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentModeIndex + 1) % modes.length];
    this.saveToLocalStorage();
    return this.repeatMode;
  }

  /**
   * Set repeat mode
   */
  setRepeatMode(mode) {
    if (['off', 'one', 'all'].includes(mode)) {
      this.repeatMode = mode;
      this.saveToLocalStorage();
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  /**
   * Get the full queue
   */
  getQueue() {
    return this.queue;
  }

  /**
   * Move track from one position to another
   */
  moveTrack(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.queue.length &&
        toIndex >= 0 && toIndex < this.queue.length) {
      const [movedItem] = this.queue.splice(fromIndex, 1);
      this.queue.splice(toIndex, 0, movedItem);

      // Update currentIndex if needed
      if (this.currentIndex === fromIndex) {
        this.currentIndex = toIndex;
      } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
        this.currentIndex--;
      } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
        this.currentIndex++;
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Save queue state to localStorage
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem('playlist', JSON.stringify({
        queue: this.queue,
        currentIndex: this.currentIndex,
        shuffleMode: this.shuffleMode,
        repeatMode: this.repeatMode
      }));
    } catch (error) {
      console.error('Failed to save playlist to localStorage:', error);
    }
  }

  /**
   * Load queue state from localStorage
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('playlist');
      if (saved) {
        const data = JSON.parse(saved);
        this.queue = data.queue || [];
        this.currentIndex = data.currentIndex || -1;
        this.shuffleMode = data.shuffleMode || false;
        this.repeatMode = data.repeatMode || 'off';
      }
    } catch (error) {
      console.error('Failed to load playlist from localStorage:', error);
    }
  }
}

// Export to global scope
window.Playlist = Playlist;
