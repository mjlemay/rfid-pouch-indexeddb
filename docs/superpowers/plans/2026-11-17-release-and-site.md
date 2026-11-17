# Release Zip and Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish each version of the static build as a zip on GitHub Releases through a version-gated workflow, and serve a landing page on GitHub Pages with a Download button for the latest zip.

**Architecture:** A shell script `scripts/package.sh` turns `out/` into two zips so the packaging step can be run locally. Three workflows under `.github/workflows/` run pull request checks, the version-gated release, and a post-release link check. A single self-contained `docs/index.html` is the landing page, served by GitHub Pages from main `/docs`.

**Tech Stack:** GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`), bash, zip, plain HTML and CSS, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-17-release-and-site-design.md`

**Branch:** `feat/release-and-site` off `main`.

**Conventions:** Commit only when Mertie confirms; each task ends with a proposed commit message. Say "USB RFID reader" never "keyboard-wedge". American spelling. No abbreviated names. Never use Mertie's last name in page content; the footer says "MIT License" only. The repository is `mjlemay/rfid-pouch-indexeddb`.

---

## File structure

- Create `scripts/package.sh`: build `release/` with both zips.
- Modify `package.json`: add the `package` script.
- Modify `.gitignore`: add `release`.
- Create `.github/workflows/ci.yml`, `release.yml`, `verify-downloads.yml`.
- Create `docs/index.html` and `docs/.nojekyll`.
- Modify `public/DIRECTIONS.md`: new name and run steps.
- Modify `README.md`: Releases section.

---

### Task 1: Packaging script

**Files:**
- Create: `scripts/package.sh`
- Modify: `package.json`, `.gitignore`

- [ ] **Step 1: Run the script before it exists to see the failure**

Run: `npm run package`
Expected: `Missing script: "package"`.

- [ ] **Step 2: Write the script**

```bash
#!/usr/bin/env bash
# Packages the static build in out/ as two zips under release/:
# simple-rfid-notekeeper-<version>.zip and a fixed-name copy for the latest link.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f out/index.html ]; then
  echo "out/index.html is missing. Run npm run build first." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
NAME="simple-rfid-notekeeper"

rm -rf release
mkdir -p "release/$NAME"
cp -R out/. "release/$NAME/"

cd release
zip -qr "$NAME-$VERSION.zip" "$NAME"
cp "$NAME-$VERSION.zip" "$NAME.zip"

echo "release/$NAME-$VERSION.zip"
echo "release/$NAME.zip"
```

Run: `chmod +x scripts/package.sh`

- [ ] **Step 3: Wire the script and ignore the output**

In `package.json` scripts, after `"build": "next build",` add:

```json
    "package": "scripts/package.sh",
```

In `.gitignore`, after the `out` line under the Next.js comment, add `release`.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run package && unzip -l release/simple-rfid-notekeeper.zip | head -8 && ls release`
Expected: the listing starts with `simple-rfid-notekeeper/` and includes `simple-rfid-notekeeper/index.html`; `ls release` shows the folder and both zips. `git status --short` does not list `release/`.

Run: `rm -rf out && npm run package; echo "exit $?"`
Expected: the missing-build message and exit 1. Then `npm run build` again.

- [ ] **Step 5: Propose commit**

`Add a packaging script that zips the static build`

---

### Task 2: Pull request checks workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Checks

on:
  pull_request:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Test
        run: npm test

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Verify the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('ci.yml ok')"`
Expected: `ci.yml ok`.

- [ ] **Step 3: Propose commit**

`Run tests, type check, lint, and build on pull requests`

---

### Task 3: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.VERSION }}
      exists: ${{ steps.tag.outputs.EXISTS }}
    steps:
      - name: Check out with tags
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Read the version from package.json
        id: version
        run: echo "VERSION=$(node -p "require('./package.json').version")" >> "$GITHUB_OUTPUT"

      - name: Check whether the release tag exists
        id: tag
        run: |
          if git rev-parse "v${{ steps.version.outputs.VERSION }}" >/dev/null 2>&1; then
            echo "EXISTS=true" >> "$GITHUB_OUTPUT"
          else
            echo "EXISTS=false" >> "$GITHUB_OUTPUT"
          fi

  build:
    needs: check-version
    if: needs.check-version.outputs.exists == 'false'
    runs-on: ubuntu-latest
    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Test
        run: npm test

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Package
        run: npm run package

      - name: Upload the zips
        uses: actions/upload-artifact@v4
        with:
          name: simple-rfid-notekeeper
          path: release/*.zip
          retention-days: 7

  release:
    needs: [check-version, build]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download the zips
        uses: actions/download-artifact@v4
        with:
          name: simple-rfid-notekeeper
          path: release

      - name: Publish the release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.check-version.outputs.version }}
          name: v${{ needs.check-version.outputs.version }}
          files: release/*.zip
          draft: false
          prerelease: false
          generate_release_notes: true
```

- [ ] **Step 2: Verify the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/release.yml','utf8')); console.log('release.yml ok')"`
Expected: `release.yml ok`.

- [ ] **Step 3: Propose commit**

`Publish a GitHub Release with the zip when the version changes`

---

### Task 4: Download link check workflow

**Files:**
- Create: `.github/workflows/verify-downloads.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Verify Download Link

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Wait for the assets to settle
        run: sleep 30

      - name: Request the latest zip
        run: |
          URL="https://github.com/mjlemay/rfid-pouch-indexeddb/releases/latest/download/simple-rfid-notekeeper.zip"
          if curl -f -L -I "$URL" > /dev/null 2>&1; then
            echo "The latest zip link works."
          else
            echo "::error::The latest zip link failed: $URL"
            exit 1
          fi
```

- [ ] **Step 2: Verify the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/verify-downloads.yml','utf8')); console.log('verify-downloads.yml ok')"`
Expected: `verify-downloads.yml ok`.

- [ ] **Step 3: Propose commit**

`Check the latest zip link after each release`

---

### Task 5: Landing page

**Files:**
- Create: `docs/index.html`, `docs/.nojekyll`

- [ ] **Step 1: Write the page**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>The Simple RFID Notekeeper</title>
  <meta name="description" content="Scan a tag with a USB RFID reader and keep notes on it. Everything stays in your browser.">
  <style>
    :root {
      --background: #171717;
      --surface: #0a0a0a;
      --raised: #262626;
      --line: #404040;
      --text: #ededed;
      --accent: #86efac;
      --accent-text: #052e16;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--background);
      color: var(--text);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
    }
    main {
      max-width: 44rem;
      margin: 0 auto;
      padding: 3rem 16px 4rem;
    }
    h1 { font-size: 2.5rem; margin: 0 0 0.25rem; }
    .tagline { font-size: 1.25rem; opacity: 0.8; margin: 0 0 2rem; }
    p { font-size: 1.1rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin: 2rem 0;
    }
    .download {
      display: inline-block;
      background: var(--accent);
      color: var(--accent-text);
      font-size: 1.25rem;
      font-weight: 600;
      text-decoration: none;
      padding: 0.9rem 1.6rem;
      border-radius: 0.75rem;
    }
    .download:hover { filter: brightness(1.1); }
    .caption { margin: 0.75rem 0 0; opacity: 0.7; font-size: 1rem; }
    a { color: var(--accent); }
    ol { padding-left: 1.5rem; }
    li { margin: 0.5rem 0; font-size: 1.1rem; }
    code {
      background: var(--raised);
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      font-size: 0.95em;
    }
    footer {
      border-top: 1px solid var(--line);
      margin-top: 3rem;
      padding-top: 1.5rem;
      opacity: 0.7;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>The Simple RFID Notekeeper</h1>
    <p class="tagline">Scan a tag, keep a note. Everything stays in your browser.</p>

    <p>
      Plug in a USB RFID reader, scan a tag, and the app opens a record for it. Add notes and
      templated fields such as owner, quantity, or in service. Every record, scan, and change is
      stored in the browser with IndexedDB. Nothing leaves the machine, and the records can be
      exported and imported as JSON or CSV.
    </p>

    <section class="card">
      <a class="download" href="https://github.com/mjlemay/rfid-pouch-indexeddb/releases/latest/download/simple-rfid-notekeeper.zip">Download the latest release</a>
      <p class="caption">
        A zip of the static site, no install needed.
        <a href="https://github.com/mjlemay/rfid-pouch-indexeddb/releases">All releases</a>
      </p>
    </section>

    <h2>How to run it</h2>
    <ol>
      <li>Download the zip.</li>
      <li>Unzip it. You get a folder named <code>simple-rfid-notekeeper</code>.</li>
      <li>Open <code>index.html</code> inside that folder in Chrome or Edge.</li>
      <li>Plug in the USB RFID reader and scan a tag.</li>
      <li>Keep using the same browser on the same machine. The data lives in that browser, and clearing its site data deletes it.</li>
      <li>Use Import and Export inside the app to move records to another browser or machine.</li>
    </ol>

    <footer>
      <a href="https://github.com/mjlemay/rfid-pouch-indexeddb">Source on GitHub</a> · MIT License
    </footer>
  </main>
</body>
</html>
```

Run: `touch docs/.nojekyll`

- [ ] **Step 2: Verify**

Run: `open docs/index.html` and check the text, the button link, and that narrowing the window to phone width shows no horizontal scroll.

- [ ] **Step 3: Propose commit**

`Add the landing page for GitHub Pages`

---

### Task 6: Directions, README, and verification

**Files:**
- Modify: `public/DIRECTIONS.md`, `README.md`
- Modify: `docs/superpowers/plans/2026-11-17-release-and-site.md` (tick boxes)

- [ ] **Step 1: Rewrite the directions shipped in the zip**

Replace `public/DIRECTIONS.md` with:

```markdown
# The Simple RFID Notekeeper

Open `index.html` in this folder in Chrome or Edge. Plug in your USB RFID reader and scan a tag to create a record and add notes to it.

## Reminders

- The data is stored in the browser, so use the same browser on the same machine each time.
- Nothing is written to the RFID tag itself, only to a database inside your browser.
- Clearing the browser's site data deletes everything. Use Import and Export inside the app to keep a copy.
- If the reader stops being picked up, refresh the page.
```

- [ ] **Step 2: README Releases section**

Before the `## Reminders` heading in `README.md`, add:

```markdown
## Releases

Every push to `main` runs the Release workflow. It reads the version from `package.json` and, when no `v<version>` tag exists yet, builds the static site, zips it as `simple-rfid-notekeeper-<version>.zip` and `simple-rfid-notekeeper.zip`, and publishes a GitHub Release. To ship a new version, bump the version in `package.json` and merge to `main`.

The landing page at https://mjlemay.github.io/rfid-pouch-indexeddb/ always links to the latest zip. To build the zips locally, run `npm run build && npm run package`.

```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && npm run package && for f in .github/workflows/*.yml; do node -e "require('js-yaml').load(require('fs').readFileSync('$f','utf8')); console.log('$f ok')"; done`
Expected: all green, both zips listed, three `ok` lines. Then `unzip -l release/simple-rfid-notekeeper.zip | grep DIRECTIONS` shows the directions file inside the folder.

- [ ] **Step 4: Propose commit**

`Describe releases in the README and refresh the shipped directions`

---

### Task 7: Open the pull request and set up Pages (after Mertie confirms)

- [ ] **Step 1: Push and open the PR** against main with `gh pr create`, body ending with the attribution lines. The Checks workflow runs on the PR as its first live test.
- [ ] **Step 2: Point GitHub Pages at main `/docs`**

Run: `gh api -X POST repos/mjlemay/rfid-pouch-indexeddb/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/docs'`
Expected: a JSON response with `html_url` `https://mjlemay.github.io/rfid-pouch-indexeddb/`. Pages serves the page once `docs/index.html` is on main, so the site goes live at merge.

- [ ] **Step 3: After merge** confirm the Release run is green, `gh release view v0.1.0` lists both zips, the Verify Download Link run passed, and the Pages URL serves the landing page.
