const { app } = require('@azure/functions');
const https = require('https');
const zlib = require('zlib');

const AVATAR_CDN_BASE = 'fde-prd-qc-aiassistant-ui-bdg3bhapgadnfehh.a01.azurefd.net';

app.http('avatarProxy', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'avatar-proxy/{*path}',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                }
            };
        }

        const path = request.params.path || '';
        const targetUrl = `https://${AVATAR_CDN_BASE}/built-frontend/${path}`;

        context.log(`Proxying avatar request to: ${targetUrl}`);

        try {
            const response = await proxyAvatarRequest(targetUrl, request);
            return response;
        } catch (error) {
            context.error('Avatar proxy error:', error);
            return {
                status: 500,
                body: `Proxy error: ${error.message}`
            };
        }
    }
});

function proxyAvatarRequest(targetUrl, request) {
    return new Promise((resolve, reject) => {
        const url = new URL(targetUrl);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0'
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            const chunks = [];
            let stream = proxyRes;

            // Handle compressed responses
            const encoding = proxyRes.headers['content-encoding'];
            if (encoding === 'gzip') {
                stream = proxyRes.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                stream = proxyRes.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
                stream = proxyRes.pipe(zlib.createBrotliDecompress());
            }

            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
                let body = Buffer.concat(chunks);
                const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
                
                // For JavaScript files, rewrite URLs to use our proxy
                if (contentType.includes('javascript') || targetUrl.endsWith('.js')) {
                    let jsContent = body.toString('utf-8');
                    
                    // Replace CDN URLs with proxy URLs
                    jsContent = jsContent.replace(
                        /https:\/\/fde-prd-qc-aiassistant-ui-bdg3bhapgadnfehh\.a01\.azurefd\.net\/built-frontend\//g,
                        '/api/avatar-proxy/'
                    );
                    
                    // Replace API URLs with proxy
                    jsContent = jsContent.replace(
                        /https:\/\/apimanagement-prod-qc-vq\.azure-api\.net/g,
                        '/api/api-proxy'
                    );
                    
                    body = Buffer.from(jsContent, 'utf-8');
                }

                const responseHeaders = {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                };

                resolve({
                    status: proxyRes.statusCode,
                    headers: responseHeaders,
                    body: body
                });
            });

            stream.on('error', reject);
        });

        proxyReq.on('error', reject);
        proxyReq.end();
    });
}
