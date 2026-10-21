# Conservation-Lighting-Architect

This repository contains a desktop-friendly, single-page web app for Canterbury Museum staff to estimate light exposure against Blue Wool Standard thresholds and generate a slide-ready JPEG.

How to run it:

1. Open the repository folder in File Explorer.
2. Double-click `index.html` to open it in your default browser.
3. If your browser blocks local file access for some features, open a local static server from the repository folder instead:

   `python -m http.server 8000`

   Then open `http://localhost:8000` in the browser.

The app includes:
- collection item details and image upload
- continuous lighting and interactive lighting modes
- automatic exposure calculations
- status banding in green/amber/red
- JPEG export for use in PowerPoint slides

No data is saved outside the current browser session.
