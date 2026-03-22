const express = require('express');
const router = express.Router();

/**
 * Backend proxy cho SoundCloud hiện đã được chuyển sang Frontend Fetch
 * và SoundCloud Widget Embed để tránh bị chặn IP (403 Forbidden).
 * File này được giữ lại dưới dạng stub để đảm bảo tính tương thích của route API.
 */

// GET /api/soundcloud/me/tracks - Trả về mảng rỗng (Fetch đã chuyển sang Frontend)
router.get('/me/tracks', (req, res) => {
  res.json({ success: true, data: [] });
});

// GET /api/soundcloud/tracks/:id/stream - Trả về lỗi (Hiện đã dùng Widget Embed)
router.get('/tracks/:id/stream', (req, res) => {
  res.status(410).json({ error: 'Endpoint này đã tạm ngưng. Vui lòng sử dụng SoundCloud Widget Embed từ Frontend.' });
});

module.exports = router;
