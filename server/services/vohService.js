const axios = require('axios');
const cheerio = require('cheerio');

class VOHService {
  constructor() {
    this.baseUrl = 'https://voh.com.vn';
    this.listUrl = 'https://voh.com.vn/radio/nhung-la-thu-xanh-02220516000000122.html';
  }

  /**
   * Get list of "Những lá thư xanh" episodes
   * @returns {Promise<Array>} Array of episode objects
   */
  async getEpisodes() {
    try {
      console.log(`[VOHService] Fetching episodes from: ${this.listUrl}`);
      const response = await axios.get(this.listUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const nextDataJson = $('#__NEXT_DATA__').html();
      const episodes = [];

      if (nextDataJson) {
        try {
          const nextData = JSON.parse(nextDataJson);
          const listData = nextData.props.pageProps.pageData.radioList.data || [];
          
          listData.forEach(item => {
            episodes.push({
              id: item.idNew || item.id,
              title: item.title,
              thumbnail: item.image || '/img/voh-placeholder.png',
              channel: 'VOH Radio',
              url: this.baseUrl + (item.slugUsed || item.slug),
              description: item.introduction || '',
              isVOH: true
            });
          });
        } catch (parseError) {
          console.error('[VOHService] Error parsing __NEXT_DATA__:', parseError.message);
        }
      }

      // Fallback to basic scraping if JSON failed or is empty
      if (episodes.length === 0) {
        console.log('[VOHService] JSON parsing failed or empty, falling back to CSS selectors');
        $('.post-item').each((i, el) => {
          const $el = $(el);
          const $link = $el.find('.post-content h3 a').length > 0 ? $el.find('.post-content h3 a') : $el.find('.post-image a');
          const title = $link.text().trim();
          const link = $link.attr('href');
          const thumbnail = $el.find('.post-image img').attr('src');
          
          if (title && link) {
            episodes.push({
              id: this._extractId(link),
              title: title,
              thumbnail: thumbnail || '/img/voh-placeholder.png',
              channel: 'VOH Radio',
              url: link.startsWith('http') ? link : this.baseUrl + link,
              isVOH: true
            });
          }
        });
      }

      console.log(`[VOHService] Found ${episodes.length} episodes`);
      return episodes;
    } catch (error) {
      console.error('[VOHService] Error fetching episodes:', error.message);
      throw new Error(`Failed to fetch VOH episodes: ${error.message}`);
    }
  }

  /**
   * Get direct audio URL from episode page
   * @param {string} episodeUrl - URL of the episode page
   * @returns {Promise<string>} Direct audio URL
   */
  async getAudioUrl(episodeUrl) {
    try {
      console.log(`[VOHService] Extracting audio from: ${episodeUrl}`);
      const response = await axios.get(episodeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // The audio URL is often hidden in a script or data attribute
      // Based on browser subagent, it might be in the source or loaded via API
      // Let's look for common patterns in the HTML
      const html = response.data;
      
      // Pattern 1: Search for .mp3 in script tags
      const mp3Regex = /https:\/\/cms\.voh\.com\.vn\/vohdata\/default\/[^\s'"]+\.mp3/i;
      const match = html.match(mp3Regex);
      
      if (match) {
        return match[0];
      }

      // Pattern 2: Search for data-src or source tags
      const $ = cheerio.load(html);
      const audioSrc = $('audio source').attr('src') || $('audio').attr('src');
      if (audioSrc && audioSrc.includes('.mp3')) {
        return audioSrc.startsWith('http') ? audioSrc : this.baseUrl + audioSrc;
      }

      throw new Error('Audio URL not found on page');
    } catch (error) {
      console.error('[VOHService] Error extracting audio URL:', error.message);
      throw new Error(`Failed to extract audio URL: ${error.message}`);
    }
  }

  _extractId(link) {
    // Extract ID from link like /radio/nhung-la-thu-xanh/thanh-am-cua-nang-14260319000107066.html
    const match = link.match(/-(\d+)\.html/);
    return match ? match[1] : link;
  }
}

module.exports = new VOHService();
