# Hayya.qa Local Copy

This folder contains a local copy of the hayya.qa website.

## Files

- `download_website.py` - Python script used to download the website
- `server.js` - Local Node.js server to run the site
- `downloaded-site/` - The downloaded website files

## How to Run

### Option 1: Using the Node.js Server (Recommended)

```bash
node server.js
```

Then open http://localhost:3000 in your browser.

### Option 2: Open Directly in Browser

Simply open `downloaded-site/index.html` in your browser. Note that some features may not work due to CORS restrictions and the site expecting to run from a server.

## Notes

- The site was downloaded on December 29, 2025
- Some dynamic features may not work in the local copy (like forms, API calls, etc.)
- External resources and CDN assets may still be loaded from the internet
- This is a static snapshot of the website

## Re-downloading

To download the latest version of the site:

```bash
python download_website.py
```

Or using the virtual environment:

```bash
.venv\Scripts\python.exe download_website.py
```
