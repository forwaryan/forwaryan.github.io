# Hexo 8 Migration Notes

## What Changed

- Rebuilt this repository from a generated GitHub Pages output into a real Hexo source project.
- Upgraded the build stack to Hexo `8.1.2` and `hexo-theme-next` `8.27.0`.
- Added `_config.yml` for Hexo and `_config.next.yml` for NexT theme settings.
- Added `package-lock.json` so GitHub Actions and local installs resolve the same dependency tree.
- Added `.github/workflows/pages.yml` for GitHub Pages deployment through GitHub Actions.

## Data Preservation

- The old generated files in the repository root were not removed.
- All 6 legacy posts were restored to `source/_posts/`.
- The about page was restored to `source/about/index.md`.
- Existing image assets were copied to `source/images/`.
- Original post permalinks were pinned in front matter so old URLs keep working.
- The generated `search.xml` URLs are normalized by `scripts/normalize-search-urls.js` to preserve the old single-slash URL shape.

## Verification Performed

- `npm install` with Node `24.14.0`
- `npm run check`
- Confirmed installed versions: Hexo `8.1.2`, NexT `8.27.0`
- Confirmed generated search metadata matches legacy metadata for all 6 posts.
- Confirmed generated pages exist for all legacy post URLs.
- Confirmed `/categories/` and `/tags/` render as NexT pages, not directory listings.
- Confirmed local HTTP responses:
  - `/`
  - `/2020/05/16/Linux基础命令/`
  - `/search.xml`
- Confirmed in the in-app browser:
  - `/`
  - `/about/`
  - `/archives/`
  - `/categories/`
  - `/tags/`
  - all 6 legacy post URLs
- Scanned generated HTML internal references: the only missing internal asset is the pre-existing `/images/jsjwlbybf.png`.

## Known Legacy Gap

`/images/jsjwlbybf.png` was referenced by old generated article HTML but does not exist in the current repository. It was already missing before this migration, so the upgrade did not remove it.

## Next Operational Step

Before publishing through the new workflow, change the repository's GitHub Pages source to **GitHub Actions** in repository settings.
