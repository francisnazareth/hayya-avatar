const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 3000;
const SITE_DIR = path.join(__dirname, 'downloaded-site');
const AVATAR_CDN_BASE = 'https://fde-prd-qc-aiassistant-ui-bdg3bhapgadnfehh.a01.azurefd.net/built-frontend/';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Proxy function to fetch from Azure CDN and bypass CORS
function proxyAvatarRequest(targetUrl, res) {
  https.get(targetUrl, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    
    // For JavaScript files, we need to rewrite URLs to use our proxy
    if (contentType.includes('javascript') || targetUrl.endsWith('.js')) {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        // Replace absolute CDN URLs with proxy URLs
        body = body.replace(/https:\/\/fde-prd-qc-aiassistant-ui-bdg3bhapgadnfehh\.a01\.azurefd\.net\/built-frontend\//g, '/avatar-proxy/');
        
        // For API URLs - ONLY replace the full https://domain part, keep everything else
        const apiDomain = 'https://apimanagement-prod-qc-vq.azure-api.net';
        const apiProxy = 'http://localhost:3000/api-proxy';
        
        // Create regex to match the domain with word boundaries
        const apiRegex = new RegExp(apiDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        body = body.replace(apiRegex, apiProxy);
        
        console.log('Rewriting JS file - URL replacements made');
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(body);
      });
    } else {
      // For non-JS files, just pipe through
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      proxyRes.pipe(res);
    }
  }).on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });
}

// Proxy function for API requests
function proxyApiRequest(targetUrl, req, res) {
  const url = new URL(targetUrl);
  
  // Modify headers to appear as if coming from visitqatar.com
  const modifiedHeaders = {
    ...req.headers,
    host: url.hostname,
    origin: 'https://visitqatar.com',
    referer: 'https://visitqatar.com/'
  };
  
  // Remove localhost-specific headers
  delete modifiedHeaders['sec-fetch-site'];
  
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: req.method,
    headers: modifiedHeaders
  };
  
  // Log request details for debugging
  console.log(`\n=== API Request ===`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${targetUrl}`);
  console.log(`Modified Headers:`, JSON.stringify(modifiedHeaders, null, 2));
  
  const proxyReq = https.request(options, (proxyRes) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };
    
    // Copy other headers from the response
    Object.keys(proxyRes.headers).forEach(key => {
      if (!key.toLowerCase().startsWith('access-control')) {
        headers[key] = proxyRes.headers[key];
      }
    });
    
    // Log API response status
    console.log(`API Response: ${proxyRes.statusCode} for ${req.method} ${targetUrl}`);
    console.log(`Response Headers:`, JSON.stringify(proxyRes.headers, null, 2));
    
    // Try to capture any data that comes through
    let dataReceived = false;
    let dataChunks = [];
    
    proxyRes.on('data', (chunk) => {
      dataReceived = true;
      dataChunks.push(chunk);
      console.log(`[API Data] Received chunk of ${chunk.length} bytes`);
    });
    
    proxyRes.on('end', () => {
      if (dataReceived) {
        const fullData = Buffer.concat(dataChunks).toString();
        console.log(`[API Complete] Total data: ${fullData.length} bytes`);
        if (fullData.length > 0) {
          console.log(`[API Body]:`, fullData.substring(0, 500)); // First 500 chars
        }
      } else {
        console.log(`[API Complete] No data received (empty response)`);
      }
    });
    
    // Pipe through to client
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('API proxy error:', err);
    res.writeHead(500);
    res.end('API proxy error: ' + err.message);
  });
  
  // Forward request body if present
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

const server = http.createServer((req, res) => {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  // Handle API proxy requests to bypass CORS
  if (req.url.startsWith('/api-proxy/')) {
    const apiPath = req.url.replace('/api-proxy/', '');
    const targetUrl = 'https://apimanagement-prod-qc-vq.azure-api.net/' + apiPath;
    console.log('Proxying API request:', targetUrl);
    proxyApiRequest(targetUrl, req, res);
    return;
  }

  // Handle avatar proxy requests to bypass CORS
  if (req.url.startsWith('/avatar-proxy/')) {
    const avatarPath = req.url.replace('/avatar-proxy/', '');
    const targetUrl = AVATAR_CDN_BASE + avatarPath;
    console.log('Proxying avatar request:', targetUrl);
    proxyAvatarRequest(targetUrl, res);
    return;
  }

  // Parse URL and remove query string
  let urlPath = req.url.split('?')[0];
  
  // Default to index.html for root
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  
  // DON'T decode the URL path - keep it encoded for file system lookup
  // since the files were downloaded with encoded names
  
  // Check if requesting specific files from root directory
  let filePath;
  if (urlPath === '/avatar-embed.html') {
    filePath = path.join(__dirname, 'avatar-embed.html');
  } else if (urlPath === '/avatar-custom-styles.css') {
    filePath = path.join(__dirname, 'avatar-custom-styles.css');
  } else if (urlPath === '/index.html') {
    // Serve the custom index.html with chat button from root directory
    filePath = path.join(__dirname, 'index.html');
  } else {
    // Remove leading slash and join with SITE_DIR
    filePath = path.join(SITE_DIR, urlPath.substring(1));
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    // Inject Visit Qatar AI Assistant avatar for HTML files
    if (!error && extname === '.html') {
      let htmlContent = content.toString();
      
      // Define the avatar initialization script
      // Let the avatar script create its own container
      const avatarScript = `
<!-- Visit Qatar AI Assistant Initialization Script -->
<script type="text/javascript">
(function() {
  console.log('[Avatar Init] Starting initialization...');
  window.w = "2.6.1";
  // Use local proxy to bypass CORS
  window.__APP_BASE__ = "/avatar-proxy/";
  
  // Override API base URL to use proxy
  window.__API_BASE__ = "/api-proxy/";
  
  console.log('[Avatar Init] Base URLs set:', {APP_BASE: window.__APP_BASE__, API_BASE: window.__API_BASE__});
  
  var urlParams = new URLSearchParams(window.location.search);
  if (localStorage.getItem("noAiAssistant") === "true") {
    console.log("[Avatar Init] noAiAssistant flag detected (localStorage). Skipping AI Assistant.");
    return;
  }
  
  if (urlParams.has("noAiAssistant") && urlParams.get("noAiAssistant") === "true") {
    localStorage.setItem("noAiAssistant", "true");
    console.log("[Avatar Init] noAiAssistant flag detected (urlParams). Skipping AI Assistant.");
    return;
  }
  
  var manifestUrl = window.__APP_BASE__ + ".vite/manifest.json?nocache=true&v=" + Date.now();
  console.log('[Avatar Init] Fetching manifest from:', manifestUrl);
  
  fetch(manifestUrl)
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load AI Assistant manifest (status: ' + response.status + ')');
      return response.json();
    })
    .then(function(manifest) {
      console.log('[Avatar Init] Manifest loaded successfully:', Object.keys(manifest));
      var indexEntry = manifest['index.html'];
      console.log('[Avatar Init] Index entry found:', !!indexEntry);
      
      if (indexEntry && indexEntry.css && indexEntry.css.length > 0) {
        var cssFile = indexEntry.css[0];
        var cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = window.__APP_BASE__ + cssFile + '?nocache=true&v=' + Date.now();
        document.head.appendChild(cssLink);
        console.log('[Avatar Init] CSS loaded:', cssFile);
      }
      
      if (indexEntry && indexEntry.file) {
        var scriptUrl = window.__APP_BASE__ + indexEntry.file + '?nocache=true&v=' + Date.now();
        console.log('[Avatar Init] Loading script:', indexEntry.file);
        var script = document.createElement('script');
        script.type = 'module';
        script.src = scriptUrl;
        script.onload = function() {
          console.log('[Avatar Init] Script loaded successfully - Vue will create its own container');
        };
        script.onerror = function(e) {
          console.error('[Avatar Init] Failed to load script:', e);
        };
        document.body.appendChild(script);
      }
    })
    .catch(function(error) {
      console.error('[Avatar Init] Error:', error);
    });
})();
</script>
`;
      
      // Inject script before </body> - let avatar create its own container
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', avatarScript + '\n</body>');
        content = Buffer.from(htmlContent);
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
      return;
    }
    if (error) {
      if (error.code === 'ENOENT') {
        // Try adding .html extension
        fs.readFile(filePath + '.html', (error2, content2) => {
          if (error2) {
            console.log('404 Not Found:', urlPath);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - File Not Found</h1><p>Path: ' + urlPath + '</p>', 'utf-8');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2, 'utf-8');
          }
        });
      } else {
        console.log('Server Error:', error);
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`✓ Local server running!`);
  console.log(`→ Open http://localhost:${PORT} in your browser`);
  console.log(`Press Ctrl+C to stop the server`);
});
