# Hayya Avatar

A web application featuring the Visit Qatar AI Assistant avatar integration with proxy support for local development.

## Overview

This project provides a local development environment for testing the Visit Qatar AI Assistant avatar widget. It includes a Node.js proxy server that handles CORS restrictions when communicating with external APIs and CDN resources.

## Features

- 🤖 Integrated AI Assistant avatar widget
- 🔄 CORS proxy for API requests to Azure API Management
- 🖼️ Avatar CDN proxy for serving frontend assets
- 🎨 Custom styling support for the avatar widget

## Project Structure

```
├── index.html              # Main landing page with chat launcher
├── server.js               # Node.js proxy server
├── avatar-embed.html       # Avatar widget embed page
├── avatar-custom-styles.css # Custom avatar styling
├── downloaded-site/        # Downloaded website assets
└── package.json            # Node.js dependencies
```

## Prerequisites

- Node.js (v16 or higher)
- npm

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/francisnazareth/hayya-avatar.git
   cd hayya-avatar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running Locally

Start the development server:

```bash
node server.js
```

Open http://localhost:3000 in your browser.

## How It Works

The server acts as a proxy to bypass CORS restrictions:

- `/api-proxy/*` → Proxies requests to `apimanagement-prod-qc-vq.azure-api.net`
- `/avatar-proxy/*` → Proxies requests to the Azure Front Door CDN for avatar assets

JavaScript files are automatically rewritten to redirect API and CDN calls through the local proxy.

## License

ISC
