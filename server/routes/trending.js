const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Cache trending results for 30 minutes
let trendingCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 30 * 60 * 1000 // 30 minutes
};

// Trending search queries - rotated randomly for variety
const TRENDING_QUERIES = [
  'new and trending music videos global 2026',
  'youtube music new and trending official videos',
  'latest music videos trending worldwide 2026',
  'hot new music videos this week global',
  'top trending music videos global chart 2026'
];

// GET /api/trending
router.get('/', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (trendingCache.data && (now - trendingCache.timestamp) < trendingCache.CACHE_DURATION) {
      console.log('[Trending] Returning cached data');
      return res.json({ success: true, data: trendingCache.data, cached: true });
    }

    // Pick a random query for variety
    const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
    console.log(`[Trending] Fetching fresh results for: "${query}"`);
    
    const videos = await youtubeService.searchVideos(query, 20);

    // Cache the results
    trendingCache.data = videos;
    trendingCache.timestamp = now;

    console.log(`[Trending] Successfully fetched ${videos.length} videos`);
    res.json({ success: true, data: videos, cached: false });
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
