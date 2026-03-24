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
      
      const results = await yts({ listId: playlistId });
      
      if (!results || !results.videos) {
        return [];
      }

      const videos = results.videos.slice(0, maxResults);
      console.log(`[YouTubeService] Found ${videos.length} videos in playlist: "${results.title}"`);

      return videos.map(video => ({
        id: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channel: video.author.name,
        channelUrl: video.author.url,
        duration: video.duration.timestamp,
        durationSeconds: video.duration.seconds,
        views: video.views,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        description: '' // Playlist items in yt-search usually don't have descriptions
      }));
    } catch (error) {
      console.error('[YouTubeService] Error getting playlist videos:', error);
      throw new Error(`Failed to get playlist videos: ${error.message}`);
    }
  }
}

module.exports = new YouTubeService();
