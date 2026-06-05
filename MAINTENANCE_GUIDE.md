# 3K visualization maintenance guide

This folder is the long-term editable source for the 2026 Q2 3K operations visualization.

## Primary files

- `src/app.js`: page modules, interactions, charts, drawers, upload behavior.
- `styles.css`: layout, spacing, visual style, desktop and mobile responsive rules.
- `data/competition-data.js`: rules, formulas, targets, sample metrics, source text.
- `data/3k-q2-data-template.xlsx`: Legacy Excel upload template. The preferred update source is now the Creator Center raw export containing `发布明细报表` and `KOS对应关系`.
- `index.html`: static page entry and CDN imports.

## What not to edit directly

- `dist/github-pages-chunked/index.html`
- `dist/github-pages-chunked/payload/*.txt`
- `dist/oss-stable/vendor/*.mjs`

Those files are generated publishing artifacts. Keep them as the latest online backup, but make future changes in the source files above.

## Local preview

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/
```

## Release checklist

1. Edit source files.
2. Preview locally on desktop width and mobile width.
3. Upload a Creator Center raw workbook and confirm the office KOS race panel and the regional KOS race panel refresh separately.
   The Jinji publishing-status table belongs to the regional KOS race, not the office race.
   For the regional KOS race, count published-success rows by the workbook's internal `内容发布时间`; the filename cutoff is only a cross-day note.
4. Check that text does not overlap and no horizontal scroll appears on mobile.
5. Regenerate the publishing package.
6. Push the regenerated package to GitHub Pages.
7. Use a new version query in the public link, for example `?v=20260520-final`.

## Current public link

```text
https://jayzhou0214-ops.github.io/3k-ops-visualization-q2/?v=20260511-final#hero
```

## More stable domestic hosting

For Tencent COS or Alibaba OSS, upload the full folder:

```text
dist/oss-stable
```

See `OSS_DEPLOY_GUIDE.md` for the deployment checklist. This package vendors the front-end dependencies locally, so the page no longer depends on GitHub Pages or esm.sh at runtime.
