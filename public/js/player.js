// YouTube Player Controller
class YouTubePlayer {
  constructor() {
    this.player = null;
    this.currentVideo = null;
    this.isPlaying = false;
    this.isReady = false;
    this.onEndedCallback = null;
    this.onStateChangeCallback = null;
    this.pipCheckInterval = null;
  }

  /**
   * Initialize the YouTube IFrame Player
   */
  init() {
    return new Promise((resolve) => {
      // YouTube IFrame API automatically calls onYouTubeIframeAPIReady when ready
      window.onYouTubeIframeAPIReady = () => {
        this.player = new YT.Player('player-container', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.origin
          },
          events: {
            onReady: () => this.onPlayerReady(resolve),
            onStateChange: (event) => this.onPlayerStateChange(event)
          }
        });
      };
    });
  }

  /**
   * Called when player is ready
   */
  onPlayerReady(resolve) {
    this.isReady = true;
    console.log('YouTube Player ready');

    // Aggressive PiP prevention
    this.disablePictureInPicture();

    // Monitor and prevent PiP continuously
    this.startPipPrevention();

    resolve();
  }

  /**
   * Disable Picture-in-Picture aggressively
   */
  disablePictureInPicture() {
    const iframe = document.querySelector('#player-container iframe');
    if (iframe) {
      // Set multiple attributes to disable PiP
      iframe.setAttribute('disablePictureInPicture', 'true');
      iframe.setAttribute('disablepictureinpicture', 'true');
      iframe.style.pointerEvents = 'none';
      iframe.allow = 'autoplay; encrypted-media';

      console.log('✅ PiP disabled on iframe');

      // Try to access video element inside iframe (may fail due to CORS)
      try {
        setTimeout(() => {
          const iframeWin = iframe.contentWindow;
          const iframeDoc = iframe.contentDocument || (iframeWin ? iframeWin.document : null);
          if (iframeDoc) {
            const videoElement = iframeDoc.querySelector('video');
            if (videoElement) {
              videoElement.disablePictureInPicture = true;
              videoElement.setAttribute('disablePictureInPicture', 'true');
              videoElement.setAttribute('disablepictureinpicture', 'true');
              console.log('✅ PiP disabled on video element');
            }
          }
        }, 1000);
      } catch (e) {
        console.log('⚠️ Cannot access iframe content (CORS), but external PiP prevention is active');
      }
    }
  }

  /**
   * Start continuous PiP prevention monitoring
   */
  startPipPrevention() {
    // Prevent PiP via browser API
    if (document.pictureInPictureEnabled) {
      document.addEventListener('enterpictureinpicture', (e) => {
        console.log('🚫 Blocking PiP attempt...');
        e.preventDefault();
        e.stopPropagation();
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(() => {});
        }
        return false;
      }, true);

      // Also monitor for PiP state
      this.pipCheckInterval = setInterval(() => {
        if (document.pictureInPictureElement) {
          console.log('🚫 Detected PiP, exiting...');
          document.exitPictureInPicture().catch(() => {});
        }
      }, 500);
    }

    // Re-apply iframe attributes periodically (in case they get removed)
    setInterval(() => {
      this.disablePictureInPicture();
    }, 5000);
  }

  /**
   * Load a video into the player
   */
  loadVideo(videoId) {
    if (!this.isReady || !this.player) {
      console.error('Player not ready');
      return;
    }

    this.player.loadVideoById(videoId);
    this.currentVideo = { id: videoId };

    // Ensure PiP is disabled after loading new video
    setTimeout(() => {
      this.disablePictureInPicture();
    }, 500);
  }

  /**
   * Play the current video
   */
  play() {
    if (this.player && this.isReady) {
      this.player.playVideo();
    }
  }

  /**
   * Pause the current video
   */
  pause() {
    if (this.player && this.isReady) {
      this.player.pauseVideo();
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (!this.player || !this.isReady) return;

    const state = this.player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Seek to a specific time
   */
  seekTo(seconds) {
    if (this.player && this.isReady) {
      this.player.seekTo(seconds, true);
    }
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume) {
    if (this.player && this.isReady) {
      this.player.setVolume(volume);
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime() {
    if (this.player && this.isReady) {
      return this.player.getCurrentTime() || 0;
    }
    return 0;
  }

  /**
   * Get video duration
   */
  getDuration() {
    if (this.player && this.isReady) {
      return this.player.getDuration() || 0;
    }
    return 0;
  }

  /**
   * Get player state
   */
  getPlayerState() {
    if (this.player && this.isReady) {
      return this.player.getPlayerState();
    }
    return -1;
  }

  /**
   * Handle player state changes
   */
  onPlayerStateChange(event) {
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.isPlaying = true;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('playing');
        }
        break;
      case YT.PlayerState.PAUSED:
        this.isPlaying = false;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('paused');
        }
        break;
      case YT.PlayerState.ENDED:
        this.isPlaying = false;
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('ended');
        }
        break;
      case YT.PlayerState.BUFFERING:
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('buffering');
        }
        break;
    }
  }

  /**
   * Set callback for when video ends
   */
  onEnded(callback) {
    this.onEndedCallback = callback;
  }

  /**
   * Set callback for state changes
   */
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  /**
   * Mute/unmute
   */
  mute() {
    if (this.player && this.isReady) {
      this.player.mute();
    }
  }

  unmute() {
    if (this.player && this.isReady) {
      this.player.unMute();
    }
  }

  isMuted() {
    if (this.player && this.isReady) {
      return this.player.isMuted();
    }
    return false;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.pipCheckInterval) {
      clearInterval(this.pipCheckInterval);
    }
    if (this.player) {
      this.player.destroy();
    }
  }
}

// Export to global scope
window.YouTubePlayer = YouTubePlayer;
