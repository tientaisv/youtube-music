const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Search videos
router.get('/', async (req, res) => {
  try {
    const { q, max = 100 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const maxResults = parseInt(max, 10);
    if (isNaN(maxResults) || maxResults < 1 || maxResults > 100) {
      return res.status(400).json({ error: 'Parameter "max" must be between 1 and 100' });
    }

    const videos = await youtubeService.searchVideos(q, maxResults);
    res.json({ success: true, data: videos, count: videos.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
