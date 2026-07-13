const express = require('express');
const router = express.Router();
const axios = require('axios');

// Cache lyrics for 1 day (lyrics don't change often)
const lyricsCache = new Map();

function cleanTitleAndArtist(title, artist) {
  let cleanTitle = title || '';
  let cleanArtist = artist || '';

  // 1. Remove brackets containing noise words
  cleanTitle = cleanTitle.replace(/[\(\[\{][^]*?\b(official|music|video|audio|mv|lyric|lyrics|vietsub|karaoke|beat|instrumental|hd|4k|raw|live|performance|cover|remix|version|studio|audio only|phim ca nhạc)\b[^]*?[\)\]\}]/gi, '');
  
  // 2. Remove standard noise words
  cleanTitle = cleanTitle.replace(/\b(official music video|official video|official mv|official audio|lyric video|lyrics video|music video|official lyric video|vietsub|karaoke|beat|instrumental|audio only)\b/gi, '');

  // 3. Split by "-" or "|" or ":" and check if artist name matches one side
  const artistCleanCheck = cleanArtist.replace(/\b(official|vevo|topic|music|channel|records|entertainment|production|group|tv|mv)\b/gi, '').replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  if (cleanTitle.includes('-')) {
    const parts = cleanTitle.split('-');
    const part0 = parts[0].trim();
    const part1 = parts[1].trim();
    if (artistCleanCheck && (part0.toLowerCase().includes(artistCleanCheck) || artistCleanCheck.includes(part0.toLowerCase()))) {
      cleanTitle = part1;
    } else if (artistCleanCheck && (part1.toLowerCase().includes(artistCleanCheck) || artistCleanCheck.includes(part1.toLowerCase()))) {
      cleanTitle = part0;
    }
  }
  
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|');
    const part0 = parts[0].trim();
    const part1 = parts[1].trim();
    if (artistCleanCheck && (part0.toLowerCase().includes(artistCleanCheck) || artistCleanCheck.includes(part0.toLowerCase()))) {
      cleanTitle = part1;
    } else if (artistCleanCheck && (part1.toLowerCase().includes(artistCleanCheck) || artistCleanCheck.includes(part1.toLowerCase()))) {
      cleanTitle = part0;
    } else {
      cleanTitle = part0;
    }
  }

  // 4. Strip leftover special characters and extra whitespaces
  cleanTitle = cleanTitle.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, ' ').replace(/\s+/g, ' ').trim();
  
  // 5. Clean up artist name
  cleanArtist = cleanArtist.replace(/\b(official|vevo|topic|music|channel|records|entertainment|production|group|tv|mv)\b/gi, '');
  cleanArtist = cleanArtist.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, ' ').replace(/\s+/g, ' ').trim();

  return {
    title: cleanTitle || title,
    artist: cleanArtist || artist
  };
}

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

    const cleaned = cleanTitleAndArtist(title, artistName);
    console.log(`[Lyrics] Original: "${title}" by "${artistName}" | Cleaned: "${cleaned.title}" by "${cleaned.artist}"`);

    // Parse Tavily API Keys
    const tavilyKeys = process.env.TAVILY_API_KEYS
      ? process.env.TAVILY_API_KEYS.split(',').map(key => key.trim()).filter(Boolean)
      : [];

    let searchContext = '';
    let usedTavily = false;

    if (tavilyKeys.length > 0) {
      console.log(`[Lyrics] Searching Tavily for lyrics of "${cleaned.title}" by "${cleaned.artist}"`);
      const searchQuery = `lời bài hát lyrics ${cleaned.title} ${cleaned.artist}`;

      for (let i = 0; i < tavilyKeys.length; i++) {
        const apiKey = tavilyKeys[i];
        try {
          console.log(`[Lyrics] Trying Tavily API key index ${i}...`);
          const searchResponse = await axios.post(
            'https://api.tavily.com/search',
            {
              api_key: apiKey,
              query: searchQuery,
              search_depth: 'basic',
              include_answer: true,
              max_results: 5
            },
            { timeout: 8000 }
          );

          if (searchResponse.data && (searchResponse.data.results || searchResponse.data.answer)) {
            const results = searchResponse.data.results || [];
            const answer = searchResponse.data.answer || '';
            
            const resultsText = results
              .map((r, idx) => `Result #${idx + 1} (${r.title}) [Source: ${r.url}]:\n${r.content}`)
              .join('\n\n');
            
            searchContext = `Suggested Answer:\n${answer}\n\nWeb Search Results:\n${resultsText}`;
            usedTavily = true;
            console.log(`[Lyrics] Successfully retrieved search context from Tavily using key index ${i}`);
            break;
          }
        } catch (tavilyError) {
          console.error(`[Lyrics] Tavily API key index ${i} failed:`, tavilyError.message);
        }
      }
    } else {
      console.log(`[Lyrics] No Tavily API keys configured. Using Groq direct completion fallback.`);
    }

    console.log(`[Lyrics] Fetching lyrics from Groq for: "${cleaned.title}" by "${cleaned.artist}" (Using Tavily: ${usedTavily})`);

    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not configured');
    }

    let prompt;
    if (usedTavily) {
      prompt = `You are an expert music lyrics assistant.
Your goal is to return the COMPLETE and ACCURATE lyrics of the song "${cleaned.title}" by "${cleaned.artist}".

Below is the search context retrieved from the web to help you identify the correct song:
---
${searchContext}
---

Instructions:
1. Provide the ENTIRE, COMPLETE, and UNTRUNCATED lyrics of the song. Do not stop halfway, do not write only snippets, and do not use placeholders like "(chorus)".
2. Use the search context above to verify the correct song, correct lyrics, and spelling. If the search context only contains snippets or partial lyrics, you MUST use your own internal knowledge to output the full, complete lyrics from start to finish.
3. If the song is in Vietnamese, return the lyrics in Vietnamese and leave the "translation" field empty.
4. If the song is in another language (like English, Korean, Japanese, Chinese, etc.), return the lyrics in its original language, and also provide a high-quality, line-by-line Vietnamese translation.
5. Do not write any introductory or concluding text. Return ONLY a valid JSON object in this format:
{
  "lyrics": "original lyrics here...",
  "translation": "Vietnamese translation here..."
}`;
    } else {
      prompt = `You are a music lyrics assistant. Return the lyrics of the song: "${cleaned.title}" by "${cleaned.artist}".
If the song is in Vietnamese, return the lyrics in Vietnamese and leave the "translation" field empty.
If the song is in another language (like English, Korean, Japanese, Chinese, etc.), return the lyrics in its original language, and also provide a high-quality Vietnamese translation.
Do not write any introductory or concluding text. Return ONLY a valid JSON object in this format:
{
  "lyrics": "original lyrics here with line breaks...",
  "translation": "Vietnamese translation here..."
}`;
    }

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
