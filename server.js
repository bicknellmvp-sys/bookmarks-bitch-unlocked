const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Bookmarks Bitch Unlocked' });
});

// API endpoint to fetch webpage titles for bookmarks
app.get('/api/fetch-title', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    let title = '';

    // Match <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    // Fallback to og:title if empty
    if (!title) {
      const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogMatch && ogMatch[1]) {
        title = ogMatch[1].trim();
      }
    }

    // Decode HTML entities
    if (title) {
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—');
    }

    if (!title) {
      title = parsedUrl.hostname.replace(/^www\./, '');
    }

    res.json({ success: true, title });
  } catch (err) {
    // Return hostname as graceful fallback
    const fallbackTitle = parsedUrl ? parsedUrl.hostname.replace(/^www\./, '') : targetUrl;
    res.json({ success: true, title: fallbackTitle, fallback: true });
  }
});

// Explicit root handler: send newtab.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'newtab.html'));
});

// Serve all static assets from root
app.use(express.static(__dirname, {
  index: ['newtab.html', 'index.html'],
  extensions: ['html', 'htm']
}));

// Fallback all SPA routes to newtab.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'newtab.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
