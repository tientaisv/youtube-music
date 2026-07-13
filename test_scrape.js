const axios = require('axios');

async function testScrape(videoId) {
  try {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching page: ${youtubeUrl}`);
    const res = await axios.get(youtubeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = res.data;
    const startToken = 'var ytInitialPlayerResponse = ';
    const startIndex = html.indexOf(startToken);
    if (startIndex === -1) {
      console.log('ytInitialPlayerResponse not found');
      return;
    }

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

    if (!jsonStr) {
      console.log('Failed to extract JSON string');
      return;
    }

    const playerObj = JSON.parse(jsonStr);
    const captionTracks = playerObj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captionTracks || captionTracks.length === 0) {
      console.log('No caption tracks found in ytInitialPlayerResponse');
      return;
    }

    console.log('Caption tracks found:');
    captionTracks.forEach((t, i) => {
      console.log(`${i}: lang=${t.languageCode}, name=${t.name.simpleText}`);
      console.log(`   URL: ${t.baseUrl}`);
    });

    const track = captionTracks[0];
    console.log(`Fetching XML from: ${track.baseUrl}`);
    
    const xmlRes = await axios.get(track.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log(`XML Status: ${xmlRes.status}`);
    console.log(`XML Content Length: ${xmlRes.data?.length || 0}`);
    console.log('Snippet of XML:');
    console.log(xmlRes.data ? xmlRes.data.substring(0, 500) : 'No data');

  } catch (error) {
    console.error('Error in test:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
    }
  }
}

testScrape('dQw4w9WgXcQ');
