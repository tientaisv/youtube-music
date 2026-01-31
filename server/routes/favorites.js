const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const FAVORITES_FILE = path.join(__dirname, '../data/favorites.json');

// Helper function to read favorites
async function readFavorites() {
  try {
    const data = await fs.readFile(FAVORITES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Helper function to write favorites
async function writeFavorites(favorites) {
  await fs.writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2), 'utf8');
}

// Get all favorites
router.get('/', async (req, res) => {
  try {
    const favorites = await readFavorites();
    res.json({ success: true, data: favorites, count: favorites.length });
  } catch (error) {
    console.error('Error reading favorites:', error);
    res.status(500).json({ error: 'Failed to read favorites' });
  }
});

// Add to favorites
router.post('/', async (req, res) => {
  try {
    const { id, title, thumbnail, channel } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'Video ID and title are required' });
    }

    const favorites = await readFavorites();

    // Check if already exists
    if (favorites.some(fav => fav.id === id)) {
      return res.status(409).json({ error: 'Video already in favorites' });
    }

    const newFavorite = {
      id,
      title,
      thumbnail,
      channel,
      addedAt: new Date().toISOString()
    };

    favorites.push(newFavorite);
    await writeFavorites(favorites);

    res.json({ success: true, data: newFavorite });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove from favorites
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const favorites = await readFavorites();
    const filteredFavorites = favorites.filter(fav => fav.id !== id);

    if (filteredFavorites.length === favorites.length) {
      return res.status(404).json({ error: 'Video not found in favorites' });
    }

    await writeFavorites(filteredFavorites);

    res.json({ success: true, message: 'Video removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;
