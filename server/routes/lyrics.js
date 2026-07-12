const express = require('express');
const router = express.Router();
const axios = require('axios');

// Cache lyrics for 1 day (lyrics don't change often)
const lyricsCache = new Map();

router.get('/', async (req, res) => {
  try {
    const { title, artist } = req.query;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const artistName = artist || 'Unknown Artist';
    const cacheKey = `${title.toLowerCase().trim()}_${artistName.toLowerCase().trim()}`;

    // Return cached lyrics if exists
    if (lyricsCache.has(cacheKey)) {
      console.log(`[Lyrics] Returning cached lyrics for: "${title}"`);
      return res.json({ success: true, data: lyricsCache.get(cacheKey) });
    }

    console.log(`[Lyrics] Fetching lyrics from Groq for: "${title}" by "${artistName}"`);

    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not configured');
    }

    const prompt = `You are a music lyrics assistant. Return the lyrics of the song: "${title}" by "${artistName}".
If the song is in Vietnamese, return the lyrics in Vietnamese and leave the "translation" field empty.
If the song is in another language (like English, Korean, Japanese, Chinese, etc.), return the lyrics in its original language, and also provide a high-quality Vietnamese translation.
Do not write any introductory or concluding text. Return ONLY a valid JSON object in this format:
{
  "lyrics": "original lyrics here with line breaks...",
  "translation": "Vietnamese translation here..."
}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        temperature: 0.2
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15s timeout
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    
    // Cache the result
    lyricsCache.set(cacheKey, result);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Lyrics Route] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
