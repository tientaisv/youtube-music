const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Cache new releases results for 30 minutes
let newReleasesCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 30 * 60 * 1000 // 30 minutes
};

// Playlist ID for "Best Vpop 2026"
const NEW_RELEASES_PLAYLIST_ID = 'PLEuibgBESvUMMuiPalWMWYH2SuO-jache';

// GET /api/new-releases
router.get('/', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (newReleasesCache.data && (now - newReleasesCache.timestamp) < newReleasesCache.CACHE_DURATION) {
      console.log('[New Releases] Returning cached data');
      return res.json({ success: true, data: newReleasesCache.data, cached: true });
    }

    console.log(`[New Releases] Fetching fresh results from playlist: "${NEW_RELEASES_PLAYLIST_ID}"`);
    
    // Get popular videos from the specified playlist
    const videos = await youtubeService.getPlaylistVideos(NEW_RELEASES_PLAYLIST_ID, 30);

    // If playlist fetch fails or is empty, fallback to search
    if (!videos || videos.length === 0) {
      console.log('[New Releases] Playlist empty or failed, falling back to search');
      const fallbackQuery = 'v-pop mới phát hành official';
      const fallbackVideos = await youtubeService.searchVideos(fallbackQuery, 20);
      newReleasesCache.data = fallbackVideos;
    } else {
      // Cache the results
      newReleasesCache.data = videos;
    }

    newReleasesCache.timestamp = now;

    console.log(`[New Releases] Successfully updated cache with ${newReleasesCache.data.length} videos`);
    res.json({ success: true, data: newReleasesCache.data, cached: false });
  } catch (error) {
    console.error('[New Releases Route] Error:', error);

    // Return cached data even if expired (on error)
    if (newReleasesCache.data) {
      console.log('[New Releases] Error occurred, returning stale cache');
      return res.json({ success: true, data: newReleasesCache.data, cached: true, stale: true });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
