const axios = require('axios');

// Helper function to parse duration strings like "MM:SS" or "HH:MM:SS" into seconds
function parseDurationToSeconds(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    seconds = parts[0];
  }
  return isNaN(seconds) ? 0 : seconds;
}

// Helper function to parse human view count formats like "12K" or "1.2M" into numbers
function parseViews(viewsStr) {
  if (!viewsStr) return 0;
  let clean = viewsStr.toLowerCase().replace(/views/g, '').replace(/[\s,]/g, '').trim();
  let multiplier = 1;
  if (clean.endsWith('k')) {
    multiplier = 1000;
    clean = clean.slice(0, -1);
  } else if (clean.endsWith('m')) {
    multiplier = 1000000;
    clean = clean.slice(0, -1);
  } else if (clean.endsWith('b')) {
    multiplier = 1000000000;
    clean = clean.slice(0, -1);
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : Math.round(val * multiplier);
}

// Helper function to recursively find and extract video metadata from ytInitialData
function extractVideosFromJSON(json) {
  const videos = [];
  
  function traverse(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
      return;
    }
    
    // Support the older playlistVideoRenderer structure
    if (obj.playlistVideoRenderer) {
      const pvr = obj.playlistVideoRenderer;
      try {
        const videoId = pvr.videoId;
        const title = pvr.title?.simpleText || pvr.title?.runs?.[0]?.text || '';
        const thumbnail = pvr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const channel = pvr.shortBylineText?.runs?.[0]?.text || '';
        const channelUrl = pvr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '';
        
        let duration = '';
        let durationSeconds = 0;
        const lengthText = pvr.lengthText?.simpleText || pvr.lengthText?.runs?.[0]?.text || '';
        if (lengthText) {
          duration = lengthText;
          durationSeconds = parseDurationToSeconds(lengthText);
        }
        
        const viewsText = pvr.videoInfo?.runs?.[0]?.text || '';
        let views = 0;
        if (viewsText) {
          const match = viewsText.replace(/,/g, '').match(/\d+/);
          if (match) views = parseInt(match[0], 10);
        }
        
        videos.push({
          id: videoId,
          title,
          thumbnail,
          channel,
          channelUrl: channelUrl ? `https://youtube.com${channelUrl}` : '',
          duration,
          durationSeconds,
          views,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          description: ''
        });
      } catch (e) {
        console.error('[YouTubeService] Error parsing playlistVideoRenderer:', e);
      }
    } 
    // Support the newer lockupViewModel structure
    else if (obj.lockupViewModel) {
      const lvm = obj.lockupViewModel;
      try {
        const videoId = lvm.contentId;
        if (videoId && lvm.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
          const meta = lvm.metadata?.lockupMetadataViewModel;
          const title = meta?.title?.content || '';
          
          let channel = '';
          let channelUrl = '';
          const firstRow = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0];
          const part = firstRow?.metadataParts?.[0];
          if (part?.text?.content) {
            channel = part.text.content;
            const channelPath = part.text.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.canonicalBaseUrl || 
                               part.text.commandRuns?.[0]?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
            if (channelPath) {
              channelUrl = `https://youtube.com${channelPath}`;
            }
          }
          
          let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const sources = lvm.contentImage?.thumbnailViewModel?.image?.sources;
          if (sources && sources.length > 0) {
            thumbnail = sources[sources.length - 1].url || sources[0].url;
          }
          
          let duration = '';
          let durationSeconds = 0;
          const overlays = lvm.contentImage?.thumbnailViewModel?.overlays;
          if (overlays && overlays.length > 0) {
            for (const overlay of overlays) {
              const badges = overlay?.thumbnailBottomOverlayViewModel?.badges;
              if (badges && badges.length > 0) {
                const badge = badges[0]?.thumbnailBadgeViewModel;
                if (badge && badge.text) {
                  duration = badge.text;
                  durationSeconds = parseDurationToSeconds(badge.text);
                  break;
                }
              }
            }
          }
          
          let views = 0;
          const secondRow = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[1];
          const viewPart = secondRow?.metadataParts?.[0];
          if (viewPart?.text?.content) {
            const viewsText = viewPart.text.content;
            views = parseViews(viewsText);
          }
          
          videos.push({
            id: videoId,
            title,
            thumbnail,
            channel,
            channelUrl,
            duration,
            durationSeconds,
            views,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            description: ''
          });
        }
      } catch (e) {
        console.error('[YouTubeService] Error parsing lockupViewModel:', e);
      }
    }
    
    for (const key of Object.keys(obj)) {
      traverse(obj[key]);
    }
  }
  
  traverse(json);
  return videos;
}

class YouTubeService {
  /**
   * Search for YouTube videos
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} Array of video objects
   */
  async searchVideos(query, maxResults = 100) {
    try {
      if (!query || query.trim() === '') {
        throw new Error('Search query cannot be empty');
      }

      console.log(`[YouTubeService] Searching: "${query}" (max: ${maxResults})`);
      
      // Add a timeout to constant-time out if yt-search hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('YouTube search timed out after 10s')), 10000);
      });

      const yts = require('yt-search');
      const results = await Promise.race([
        yts(query),
        timeoutPromise
      ]);

      const videos = results.videos.slice(0, maxResults);
      console.log(`[YouTubeService] Found ${videos.length} videos for: "${query}"`);

      return videos.map(video => ({
        id: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channel: video.author.name,
        channelUrl: video.author.url,
        duration: video.timestamp,
        durationSeconds: video.seconds,
        views: video.views,
        url: video.url,
        description: video.description
      }));
    } catch (error) {
      console.error('[YouTubeService] Error searching videos:', error);
      throw new Error(`Failed to search videos: ${error.message}`);
    }
  }

  /**
   * Get videos from a YouTube playlist
   * @param {string} playlistId - YouTube playlist ID
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} Array of video objects
   */
  async getPlaylistVideos(playlistId, maxResults = 100) {
    try {
      if (!playlistId || playlistId.trim() === '') {
        throw new Error('Playlist ID cannot be empty');
      }

      console.log(`[YouTubeService] Fetching playlist: "${playlistId}" (max: ${maxResults})`);
      
      const url = `https://www.youtube.com/playlist?list=${playlistId}`;
      const res = await axios.get(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept-language': 'en-US,en;q=0.9',
        }
      });

      const html = res.data;
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      let ytInitialData = null;

      $('script').each((i, el) => {
        const text = $(el).html();
        if (text && text.includes('ytInitialData')) {
          const match = text.match(/ytInitialData\s*=\s*({.+?});/);
          if (match) {
            try {
              ytInitialData = JSON.parse(match[1]);
            } catch (e) {}
          } else {
            const match2 = text.match(/ytInitialData\s*=\s*({.+?})\s*($|;)/);
            if (match2) {
              try {
                ytInitialData = JSON.parse(match2[1]);
              } catch (e) {}
            }
          }
        }
      });

      if (!ytInitialData) {
        throw new Error('Could not find ytInitialData in YouTube page');
      }

      const allVideos = extractVideosFromJSON(ytInitialData);
      const videos = allVideos.slice(0, maxResults);
      console.log(`[YouTubeService] Found ${videos.length} videos in playlist: "${playlistId}"`);

      return videos;
    } catch (error) {
      console.error('[YouTubeService] Error getting playlist videos:', error);
      throw new Error(`Failed to get playlist videos: ${error.message}`);
    }
  }

  /**
   * Get metadata details of a YouTube video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Object containing video details
   */
  async getVideoDetails(videoId) {
    try {
      if (!videoId || videoId.trim() === '') {
        throw new Error('Video ID cannot be empty');
      }

      console.log(`[YouTubeService] Fetching details for video: "${videoId}"`);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const ytdl = require('@distube/ytdl-core');
      const info = await ytdl.getBasicInfo(youtubeUrl);
      const details = info.videoDetails;

      return {
        id: videoId,
        title: details.title,
        description: details.description || '',
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channel: details.author.name,
        channelUrl: details.author.channel_url || '',
        durationSeconds: parseInt(details.lengthSeconds, 10) || 0,
        views: parseInt(details.viewCount, 10) || 0,
        url: youtubeUrl
      };
    } catch (error) {
      console.error('[YouTubeService] Error getting video details:', error);
      // Fallback details if getBasicInfo fails
      return {
        id: videoId,
        title: 'Unknown Title',
        description: '',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channel: 'Unknown Channel',
        channelUrl: '',
        durationSeconds: 0,
        views: 0,
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
    }
  }

  /**
   * Fetch and parse the transcript of a YouTube video
   * @param {string} videoId - YouTube video ID
   * @param {string} lang - Preferred language code (default 'vi')
   * @returns {Promise<Object>} Object containing videoId, language, and segments
   */
  async getVideoTranscript(videoId, lang = 'vi') {
    try {
      if (!videoId || videoId.trim() === '') {
        throw new Error('Video ID cannot be empty');
      }

      console.log(`[YouTubeService] Fetching transcript for video: "${videoId}" (preferred lang: "${lang}")`);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let captionTracks = null;

      // Attempt 1: Using @distube/ytdl-core
      try {
        const ytdl = require('@distube/ytdl-core');
        const info = await ytdl.getInfo(youtubeUrl);
        captionTracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      } catch (e) {
        console.warn(`[YouTubeService] ytdl.getInfo failed for transcript on video ${videoId}, using fallback:`, e.message);
      }

      // Attempt 2: HTML scraping fallback
      if (!captionTracks || captionTracks.length === 0) {
        console.log(`[YouTubeService] Falling back to HTML scraping for video ${videoId}...`);
        const res = await axios.get(youtubeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        const html = res.data;
        const startToken = 'var ytInitialPlayerResponse = ';
        const startIndex = html.indexOf(startToken);
        if (startIndex !== -1) {
          const jsonStart = startIndex + startToken.length;
          let depth = 0;
          let jsonStr = '';
          for (let i = jsonStart; i < html.length; i++) {
            if (html[i] === '{') depth++;
            else if (html[i] === '}') {
              depth--;
              if (depth === 0) {
                jsonStr = html.slice(jsonStart, i + 1);
                break;
              }
            }
          }
          if (jsonStr) {
            try {
              const playerObj = JSON.parse(jsonStr);
              captionTracks = playerObj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            } catch (e) {
              console.error('[YouTubeService] Error parsing ytInitialPlayerResponse JSON:', e.message);
            }
          }
        }
      }

      if (!captionTracks || captionTracks.length === 0) {
        return this.generateLLMTranscriptFallback(videoId, lang);
      }

      // Pick original track (usually the first one in the list, or a non-asr track if possible)
      let originalTrack = captionTracks.find(t => t.kind !== 'asr');
      if (!originalTrack) {
        originalTrack = captionTracks[0];
      }

      // Fetch the original XML transcript content
      console.log(`[YouTubeService] Downloading original transcript XML from: ${originalTrack.baseUrl}`);
      const xmlResponse = await axios.get(originalTrack.baseUrl);
      const xml = xmlResponse.data;

      // Parse the original XML
      const originalSegments = parseXmlTranscript(xml);

      if (originalSegments.length === 0) {
        return this.generateLLMTranscriptFallback(videoId, lang);
      }

      // If the original language is not the requested target language (e.g. not 'vi'), fetch translation
      let translationSegments = [];
      const originalLang = originalTrack.languageCode.substring(0, 2);
      const targetLang = lang.substring(0, 2);

      if (originalLang !== targetLang) {
        try {
          const translationUrl = `${originalTrack.baseUrl}&tlang=${lang}`;
          console.log(`[YouTubeService] Downloading translated transcript XML from: ${translationUrl}`);
          const transXmlResponse = await axios.get(translationUrl);
          const transXml = transXmlResponse.data;
          translationSegments = parseXmlTranscript(transXml);
        } catch (e) {
          console.warn(`[YouTubeService] Failed to fetch automatic translation track:`, e.message);
        }
      }

      return {
        videoId,
        language: originalTrack.languageCode,
        segments: originalSegments,
        translation: translationSegments
      };
    } catch (error) {
      console.error('[YouTubeService] Error getting transcript:', error);
      throw error;
    }
  }

  /**
   * Fallback to generate transcript/lyrics using Groq LLM
   */
  async generateLLMTranscriptFallback(videoId, lang) {
    console.log(`[YouTubeService] Attempting LLM transcript fallback for video: "${videoId}"`);
    try {
      const details = await this.getVideoDetails(videoId);
      
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured');
      }

      const prompt = `You are a professional song lyrics and subtitle generator.
The user wants the COMPLETE, FULL lyrics of the following YouTube video from START TO FINISH:
Title: "${details.title}"
Channel: "${details.channel}"
Description: "${details.description.substring(0, 1000)}"
Duration: ${details.durationSeconds} seconds

CRITICAL INSTRUCTIONS:
1. You MUST include EVERY SINGLE LINE of the song from the very beginning to the very end. Do NOT cut short, do NOT skip sections, do NOT write ellipsis (...) or placeholders like "(verse 2 repeats)".
2. Generate the lyrics in the ORIGINAL language of the song (e.g. English for English songs).
3. If the original language is NOT Vietnamese, you MUST ALSO generate a line-by-line Vietnamese translation in the "translation" field — every line must have a corresponding translation with the exact same startMs, duration, and offsetText.
4. For EVERY segment, estimate realistic timestamps distributed evenly across the full ${details.durationSeconds} seconds of the video. Make sure the last segment's startMs is close to ${details.durationSeconds * 1000 - 3000}ms.
5. The translation array must have the EXACT SAME NUMBER of elements as the segments array.

Return ONLY a valid JSON object in this format:
{
  "language": "original_language_code",
  "segments": [
    {
      "text": "original line text",
      "startMs": 12000,
      "duration": 3500,
      "offsetText": "0:12"
    }
  ],
  "translation": [
    {
      "text": "dòng dịch nghĩa tiếng Việt tương ứng",
      "startMs": 12000,
      "duration": 3500,
      "offsetText": "0:12"
    }
  ]
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
          max_tokens: 8000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      if (result && result.segments && result.segments.length > 0) {
        console.log(`[YouTubeService] Successfully generated ${result.segments.length} segments via LLM fallback.`);
        return {
          videoId,
          language: result.language || 'en',
          segments: result.segments,
          translation: result.translation || []
        };
      }
    } catch (e) {
      console.error('[YouTubeService] LLM fallback error:', e.message);
    }
    throw new Error('Transcript is disabled or unavailable for this video.');
  }
}

// Helper functions for XML decode and time formatting
function parseXmlTranscript(xml) {
  const results = [];
  if (!xml || xml.trim() === '') return results;

  // 1. Try srv3 format: <p t="ms" d="ms">...
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    let text = match[3].replace(/<[^>]+>/g, '').trim(); // Remove child tags like <s>
    
    text = decodeHtmlEntities(text);
    if (text) {
      results.push({
        text,
        startMs,
        duration: durMs,
        offsetText: formatTime(startMs)
      });
    }
  }

  // 2. Fallback to classic format: <text start="s" dur="s">...
  if (results.length === 0) {
    const textRegex = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    while ((match = textRegex.exec(xml)) !== null) {
      const startSec = parseFloat(match[1]);
      const durSec = parseFloat(match[2]);
      const text = decodeHtmlEntities(match[3]);

      results.push({
        text,
        startMs: Math.round(startSec * 1000),
        duration: Math.round(durSec * 1000),
        offsetText: formatTime(startSec * 1000)
      });
    }
  }

  return results;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function formatTime(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = new YouTubeService();

