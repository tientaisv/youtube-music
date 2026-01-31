const express = require('express');
const router = express.Router();

// Get download info - return YouTube link for external tools
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Return YouTube URL for user to download with external tools
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    res.json({
      success: true,
      videoId,
      youtubeUrl,
      message: 'Use external tools to download',
      suggestions: [
        { name: 'yt-dlp', url: 'https://github.com/yt-dlp/yt-dlp' },
        { name: '4K Video Downloader', url: 'https://www.4kdownload.com/' },
        { name: 'Copy link and paste to downloader', link: youtubeUrl }
      ]
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
