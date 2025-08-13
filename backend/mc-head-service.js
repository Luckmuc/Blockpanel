// Express.js service for Minecraft head images
const express = require('express');
const axios = require('axios');
const LRU = require('lru-cache');
const pLimit = require('p-limit');
const app = express();
const port = process.env.PORT || 3001;

// Cache: 1 hour for hits, 2 min for misses
const cache = new LRU({ max: 1000, ttl: 1000 * 60 * 60 });
const missCache = new LRU({ max: 1000, ttl: 1000 * 60 * 2 });
const limit = pLimit(4);

// Minimal logging
function log(msg) { console.log(`[mc-head-service] ${msg}`); }

// GET /api/head?username=:username&size=:size
app.get('/api/head', async (req, res) => {
  const username = req.query.username;
  const size = req.query.size || 64;
  if (!username) return res.status(400).send('Missing username');

  let imageUrl;
  
  // Check cache
  let uuid = cache.get(username);
  
  if (uuid) {
    log(`Cache hit for ${username}: ${uuid}`);
    imageUrl = `https://crafatar.com/avatars/${uuid}?size=${size}&overlay`;
  } else if (missCache.has(username)) {
    log(`Cache miss for ${username}`);
    imageUrl = `https://minotar.net/avatar/${username}/${size}.png`;
  } else {
    // Limit Mojang API calls
    try {
      await limit(async () => {
        log(`Mojang lookup for ${username}`);
        const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;
        const resp = await axios.get(mojangUrl, { validateStatus: () => true });
        if (resp.status === 200 && resp.data && resp.data.id) {
          uuid = resp.data.id;
          cache.set(username, uuid);
          log(`Mojang success for ${username}: ${uuid}`);
          imageUrl = `https://crafatar.com/avatars/${uuid}?size=${size}&overlay`;
        } else if (resp.status === 204) {
          missCache.set(username, true);
          log(`Mojang: No content for ${username}`);
          imageUrl = `https://minotar.net/avatar/${username}/${size}.png`;
        } else {
          missCache.set(username, true);
          log(`Mojang error for ${username}: ${resp.status}`);
          imageUrl = `https://minotar.net/avatar/${username}/${size}.png`;
        }
      });
    } catch (error) {
      log(`Error looking up ${username}: ${error.message}`);
      imageUrl = `https://minotar.net/avatar/${username}/${size}.png`;
    }
  }

  // Fetch the actual image and return it
  if (imageUrl) {
    try {
      log(`Fetching image from: ${imageUrl}`);
      const imageResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      res.set('Content-Type', 'image/png');
      res.send(Buffer.from(imageResp.data, 'binary'));
      log(`Image sent successfully for ${username}`);
    } catch (error) {
      log(`Error fetching image for ${username}: ${error.message}`);
      res.status(500).send('Error fetching image');
    }
  } else {
    log(`No image URL found for ${username}`);
    res.status(500).send('No image URL found');
  }
});

// GET /api/head/uuid?username=:username
app.get('/api/head/uuid', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Missing username' });
  let uuid = cache.get(username);
  if (uuid) return res.json({ uuid });
  if (missCache.has(username)) return res.status(200).json({ uuid: null });
  try {
    await limit(async () => {
      const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;
      const resp = await axios.get(mojangUrl, { validateStatus: () => true });
      log(`[UUID] Mojang response for ${username}: status=${resp.status}, data=${JSON.stringify(resp.data)}`);
      if (resp.status === 200 && resp.data && resp.data.id) {
        uuid = resp.data.id;
        cache.set(username, uuid);
        return res.json({ uuid });
      } else {
        missCache.set(username, true);
        return res.status(200).json({ uuid: null, mojangStatus: resp.status, mojangData: resp.data });
      }
    });
  } catch (err) {
    log(`[UUID] Error for ${username}: ${err}`);
    return res.status(502).json({ error: 'Bad Gateway' });
  }
});

app.listen(port, () => {
  log(`Service running on port ${port}`);
});

// Export for testing
module.exports = app;
