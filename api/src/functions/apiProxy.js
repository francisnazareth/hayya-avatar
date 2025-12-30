const { app } = require('@azure/functions');
const https = require('https');

const API_BASE = 'apimanagement-prod-qc-vq.azure-api.net';

app.http('apiProxy', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'api-proxy/{*path}',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                }
            };
        }

        const path = request.params.path || '';
        const url = new URL(request.url);
        const targetUrl = `https://${API_BASE}/${path}${url.search}`;

        context.log(`Proxying API request to: ${targetUrl}`);

        try {
            const response = await proxyRequest(targetUrl, request);
            return response;
        } catch (error) {
            context.error('API proxy error:', error);
            return {
                status: 500,
                body: `Proxy error: ${error.message}`
            };
        }
    }
});

function proxyRequest(targetUrl, request) {
    return new Promise(async (resolve, reject) => {
        const url = new URL(targetUrl);
        
        // Prepare headers
        const headers = {};
        request.headers.forEach((value, key) => {
            if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
                headers[key] = value;
            }
        });
        
        // Set proper headers
        headers['host'] = url.hostname;
        headers['origin'] = 'https://visitqatar.com';
        headers['referer'] = 'https://visitqatar.com/';

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: request.method,
            headers: headers
        };

        const proxyReq = https.request(options, (proxyRes) => {
            const chunks = [];
            
            proxyRes.on('data', (chunk) => chunks.push(chunk));
            proxyRes.on('end', () => {
                const body = Buffer.concat(chunks);
                
                const responseHeaders = {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                };

                // Copy content-type from response
                if (proxyRes.headers['content-type']) {
                    responseHeaders['Content-Type'] = proxyRes.headers['content-type'];
                }

                resolve({
                    status: proxyRes.statusCode,
                    headers: responseHeaders,
                    body: body
                });
            });
        });

        proxyReq.on('error', reject);

        // Forward request body if present
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            try {
                const bodyText = await request.text();
                if (bodyText) {
                    proxyReq.write(bodyText);
                }
            } catch (e) {
                // No body to send
            }
        }

        proxyReq.end();
    });
}
