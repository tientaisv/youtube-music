const express = require('express');
const router = express.Router();
const vohService = require('../services/vohService');

// GET /api/voh/episodes
router.get('/episodes', async (req, res) => {
  try {
    const episodes = await vohService.getEpisodes();
    res.json({ success: true, data: episodes, count: episodes.length });
  } catch (error) {
    console.error('[VOH Route] Error fetching episodes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/voh/audio
router.get('/audio', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Query parameter "url" is required' });
    }
    
    const audioUrl = await vohService.getAudioUrl(url);
    res.json({ success: true, audioUrl: audioUrl });
  } catch (error) {
    console.error('[VOH Route] Error extracting audio URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
