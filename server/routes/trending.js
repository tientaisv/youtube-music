const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Cache trending results for 30 minutes
let trendingCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 30 * 60 * 1000 // 30 minutes
};

// Playlist ID for "RELEASED" (The Hit List) from Music topic channel
const HOT_PLAYLIST_ID = 'RDCLAK5uy_mOmfogvkugBD9vd5EbejT2y82WidC6as0';

// GET /api/trending
router.get('/', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (trendingCache.data && (now - trendingCache.timestamp) < trendingCache.CACHE_DURATION) {
      console.log('[Trending] Returning cached data');
      return res.json({ success: true, data: trendingCache.data, cached: true });
    }

    console.log(`[Trending] Fetching fresh results from playlist: "${HOT_PLAYLIST_ID}"`);
    
    // Get popular videos from the specified playlist
    const videos = await youtubeService.getPlaylistVideos(HOT_PLAYLIST_ID, 30);

    // If playlist fetch fails or is empty, fallback to a general search
    if (!videos || videos.length === 0) {
      console.log('[Trending] Playlist empty or failed, falling back to search');
      const fallbackQuery = 'new music videos trending global';
      const fallbackVideos = await youtubeService.searchVideos(fallbackQuery, 20);
      trendingCache.data = fallbackVideos;
    } else {
      // Cache the results
      trendingCache.data = videos;
    }

    trendingCache.timestamp = now;

    console.log(`[Trending] Successfully updated cache with ${trendingCache.data.length} videos`);
    res.json({ success: true, data: trendingCache.data, cached: false });
  } catch (error) {
    console.error('[Trending Route] Error:', error);

    // Return cached data even if expired (on error)
    if (trendingCache.data) {
      console.log('[Trending] Error occurred, returning stale cache');
      return res.json({ success: true, data: trendingCache.data, cached: true, stale: true });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
