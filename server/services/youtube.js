const yts = require('yt-search');
const axios = require('axios');
const cheerio = require('cheerio');

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
}

module.exports = new YouTubeService();
