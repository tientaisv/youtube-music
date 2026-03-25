const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Path to the service account JSON key file
const KEY_FILE_PATH = path.join(__dirname, '../../algebraic-craft-750-1b192dd8e8a2.json');

// Initialize Google Drive API
const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

/**
 * GET /api/google-drive/files
 * Liệt kê tất cả các file âm thanh mà Service Account có quyền truy cập.
 */
router.get('/files', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: "mimeType contains 'audio/' and trashed = false",
      fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink)',
      spaces: 'drive',
    });

    const files = response.data.files.map(file => ({
      id: file.id,
      title: file.name,
      artist: 'Google Drive',
      thumbnail: file.thumbnailLink || '/img/default-audio.png',
      source: 'googledrive',
      mimeType: file.mimeType
    }));

    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Google Drive API Error (list):', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/google-drive/stream/:fileId
 * Proxy dữ liệu audio từ Google Drive về Client.
 */
router.get('/stream/:fileId', async (req, res) => {
  const fileId = req.params.fileId;

  try {
    // Lấy metadata của file để biết mimeType và size (tùy chọn)
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name, mimeType, size'
    });

    // Set headers tương ứng
    res.setHeader('Content-Type', fileMetadata.data.mimeType);
    if (fileMetadata.data.size) {
      res.setHeader('Content-Length', fileMetadata.data.size);
    }
    
    if (req.query.download) {
      const filename = encodeURIComponent(fileMetadata.data.name);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    } else {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Download stream từ Google Drive
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    response.data
      .on('error', err => {
        console.error('Error streaming from Drive:', err);
        if (!res.headersSent) {
          res.status(500).end();
        }
      })
      .pipe(res);

  } catch (error) {
    console.error('Google Drive API Error (stream):', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;
