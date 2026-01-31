const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');

// Get video details by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const video = await youtubeService.getVideoDetails(id);
    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Video details error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
