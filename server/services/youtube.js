const yts = require('yt-search');

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
   * Get video details by ID
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Video details object
   */
  async getVideoDetails(videoId) {
    try {
      if (!videoId || videoId.trim() === '') {
        throw new Error('Video ID cannot be empty');
      }

      const result = await yts({ videoId });

      return {
        id: result.videoId,
        title: result.title,
        thumbnail: result.thumbnail,
        channel: result.author.name,
        channelUrl: result.author.url,
        duration: result.timestamp,
        durationSeconds: result.seconds,
        views: result.views,
        url: result.url,
        description: result.description
      };
    } catch (error) {
      console.error('Error getting video details:', error);
      throw new Error(`Failed to get video details: ${error.message}`);
    }
  }
}

module.exports = new YouTubeService();
