const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now()
  });
});

module.exports = router;
