# WarYan's Blog

This repository has been rebuilt as a Hexo source project while keeping the previous generated GitHub Pages output in place.

## Current Stack

- Hexo: `8.1.2`
- NexT theme: `8.27.0`
- Node.js: `>=20.19.0` required, Node `24` recommended
- Theme scheme: `Pisces`

## Content Recovery

The original repository only contained generated static files, not Hexo source files. The migration recovered the blog content into:

- Posts: `source/_posts/`
- About page: `source/about/index.md`
- Images: `source/images/`
- Recovery inventory: `docs/legacy-content-inventory.md`

All 6 legacy posts keep their original title, date, category, tags, and permalink. The old generated files at the repository root are intentionally untouched as a safety copy.

One historical asset reference, `/images/jsjwlbybf.png`, was already missing from the previous generated site and is documented in the inventory.

## Local Usage

```bash
npm ci
npm run check
npm run server
```

The local site is served by Hexo, usually at `http://localhost:4000`.

## Deployment

GitHub Actions is configured in `.github/workflows/pages.yml` to build the site with Node `24` and deploy the generated `public/` directory to GitHub Pages.

In the GitHub repository settings, set Pages source to **GitHub Actions** before relying on this workflow for production publishing.
