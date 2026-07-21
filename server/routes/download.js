const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');

// Stream YouTube audio directly as MP3 to client
router.get('/:videoId', async (req, res) => {
  try {
    const ytdl = require('@distube/ytdl-core');
    const { videoId } = req.params;
    const { title } = req.query;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Set headers for download
    let filename = `${videoId}.mp3`;
    if (title) {
      // Clean title for headers (remove non-ascii or special characters)
      const cleanTitle = title.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'audio';
      filename = `${cleanTitle}.mp3`;
    } else {
      try {
        const info = await ytdl.getBasicInfo(youtubeUrl);
        const titleStr = info.videoDetails.title;
        const cleanTitle = titleStr.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'audio';
        filename = `${cleanTitle}.mp3`;
      } catch (e) {
        console.warn('Failed to get video info for filename:', e.message);
      }
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    console.log(`[Download] Starting MP3 stream for: ${videoId}`);

    const audioStream = ytdl(youtubeUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      }
    });

    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-f', 'mp3',
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '44100',
      'pipe:1'
    ]);

    // Handle audio stream errors
    audioStream.on('error', (err) => {
      console.error('[Download] ytdl stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'YouTube stream error: ' + err.message });
      }
      ffmpeg.kill();
    });

    // Pipe ytdl output to ffmpeg stdin
    audioStream.pipe(ffmpeg.stdin);

    // Handle ffmpeg stdin errors (like if ytdl closes or errors)
    ffmpeg.stdin.on('error', (err) => {
      console.warn('[Download] ffmpeg stdin error:', err.message);
    });

    // Pipe ffmpeg output to response
    ffmpeg.stdout.pipe(res);

    // Handle ffmpeg process errors
    ffmpeg.on('error', (err) => {
      console.error('[Download] ffmpeg process error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'ffmpeg error: ' + err.message });
      }
    });

    // When connection is closed, terminate ffmpeg
    req.on('close', () => {
      console.log('[Download] Client closed connection, killing ffmpeg');
      ffmpeg.kill();
    });

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
