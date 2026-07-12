const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');
const axios = require('axios');

// Get search suggestions
router.get('/suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const response = await axios.get(`https://suggestqueries.google.com/complete/search`, {
      params: {
        client: 'firefox',
        ds: 'yt',
        q: q
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const suggestions = response.data[1] || [];
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
