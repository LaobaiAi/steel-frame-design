# Maintenance Guide

This document explains how to maintain the project's public-facing assets: screenshots, demo images, and the GitHub Pages landing page.

---

## Screenshots

All project screenshots are stored in `docs/assets/`. They are referenced from:
- `README.md` and `README_CN.md` (GitHub project page)
- `docs/index.html` (GitHub Pages landing page)

### How to update

1. Start the project:

   ```bash
   # Terminal 1: backend
   python servers/web_api_server.py

   # Terminal 2: frontend
   cd frontend && npm run dev
   ```

2. Run the pipeline to generate demo data:

   ```bash
   python cli/main.py run --quick
   ```

3. Take screenshots:
   - Use Playwright (see `scripts/take_screenshots.py`)
   - Or use browser DevTools (1920x1080 viewport, 2x device factor for retina)
   - Save to `docs/assets/` with the same filenames

### Screenshot files

| File | Content |
|---|---|
| `screenshot-hero.png` | Full landing page (full-page capture) |
| `screenshot-3d-viewer.png` | 3D viewer with loaded model |
| `screenshot-storyboard.png` | Step indicator + side panel + results |
| `screenshot-loads.png` | Load visualization |
| `screenshot-report.png` | HTML report preview |
| `screenshot-pipeline-flow.png` | Pipeline flow animation |
| `demo-cli.png` | CLI terminal output |

### Automation

The script `scripts/take_screenshots.py` uses Playwright to capture all screenshots automatically:

```bash
pip install playwright
python -m playwright install chromium
python scripts/take_screenshots.py
```

The script `scripts/gen_cli_demo.py` generates the CLI terminal screenshot.

---

## GitHub Pages Website

The landing page is at `docs/index.html`, styled by `docs/assets/style.css`.

### How it works

- The site is deployed via GitHub Actions (`.github/workflows/pages.yml`)
- Or you can manually configure: **Settings → Pages → Deploy from branch `master`, folder `/docs`**
- Published at: `https://laobaiai.github.io/steel-frame-design/`

### Structure

```
docs/
├── index.html          # Landing page
├── assets/
│   ├── style.css       # Landing page styles
│   ├── screenshot-*.png # Screenshots
│   └── demo-cli.png    # CLI demo image
└── maintenance-guide.md # This file
```

### How to modify

1. **Content changes** — edit `docs/index.html`
2. **Style changes** — edit `docs/assets/style.css`
3. **Add new section** — add HTML section in `index.html`, add CSS in `style.css`

After pushing to `master`, the GitHub Actions workflow automatically deploys. Wait ~1-2 minutes for changes to appear.

### Testing locally

Open `docs/index.html` directly in a browser via `file://` protocol. Note that some external resources (badge images) require internet access.

---

## Project README

Both `README.md` (English) and `README_CN.md` (Chinese) are the primary storefront for the project on GitHub.

### Screenshot layout

Screenshots are embedded in tables:

```markdown
| Left column description | Right column image |
|---|---|
| ![alt](docs/assets/screenshot-name.png) | ![alt](docs/assets/screenshot-name.png) |
```

### Badges

Badges are hosted on `img.shields.io`. To add a new badge:

```markdown
<img src="https://img.shields.io/badge/LABEL-VALUE-COLOR?logo=LOGO" alt="LABEL">
```

See [shields.io](https://shields.io/) for badge options.

---

## Quick Checklist

- [ ] Screenshots show the current UI (update after major UI changes)
- [ ] All screenshot files are under 2 MB
- [ ] Landing page loads correctly at `https://laobaiai.github.io/steel-frame-design/`
- [ ] README images render on GitHub (use raw GitHub URLs, not relative paths that break)
- [ ] Badge links are valid
