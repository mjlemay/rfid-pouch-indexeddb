# Release zip and landing page

Date: 2026-11-17

## Goal

Publish every version of the app as a zip of the static build on GitHub Releases, and serve a landing page on GitHub Pages where people can read what The Simple RFID Notekeeper does and download the latest zip. The setup mirrors the blumbotron repository: a version-gated release workflow, a hand-written page in `docs/`, and a link check after each release.

## Decisions made during brainstorming

- The site is a landing page with a Download button only. The app is not hosted live; people run it from the unzipped folder, so their data stays in their own browser on their own machine.
- A release is triggered by a version bump. Every push to main runs the workflow, which reads the version from `package.json` and publishes only when no `v<version>` tag exists yet.
- The public name is The Simple RFID Notekeeper. The zip is `simple-rfid-notekeeper-<version>.zip` with a fixed-name copy `simple-rfid-notekeeper.zip` for the site's link. The app's own default tab title stays "RFID Scans"; it is a setting.
- Packaging is a shell script in the repository so it can be run and checked locally, not a block of commands that only exists in the workflow.

## Packaging script

`scripts/package.sh` runs after `npm run build` and is wired as `npm run package`. It:

1. Reads the version from `package.json` with Node, so it needs no extra tool.
2. Removes any previous `release/` folder, then copies `out/` to `release/simple-rfid-notekeeper/`.
3. From inside `release/`, zips that folder into `simple-rfid-notekeeper-<version>.zip` and copies it to `simple-rfid-notekeeper.zip`.
4. Prints both file names.

The zip contains one top-level folder, `simple-rfid-notekeeper/`, with `index.html` inside, so unzipping on a Mac or Windows yields a single folder. `release/` is added to `.gitignore`. The script fails if `out/` is missing.

## Workflows

All three live in `.github/workflows/` and use Node 22 with the npm cache on Ubuntu.

### ci.yml

Runs on every pull request against main: checkout, setup Node, `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### release.yml

Runs on every push to main.

- `check-version`: reads `VERSION` from `package.json` with `node -p "require('./package.json').version"` and sets `EXISTS` to whether the tag `v<VERSION>` is already in the repository (full history fetch, `git rev-parse`).
- `build`: runs only when `EXISTS` is `false`. Same steps as `ci.yml`, then `npm run package`, then uploads `release/*.zip` as the artifact `simple-rfid-notekeeper`.
- `release`: downloads the artifact and publishes a GitHub Release with `softprops/action-gh-release@v2`: tag and name `v<VERSION>`, both zips as assets, generated release notes, not a draft, not a prerelease. Needs `contents: write`.

A merge that leaves the version alone runs only `check-version` and publishes nothing.

### verify-downloads.yml

Runs when a release is published, and on manual dispatch. Waits thirty seconds for assets to settle, then requests `https://github.com/mjlemay/rfid-pouch-indexeddb/releases/latest/download/simple-rfid-notekeeper.zip` with `curl -f -L -I` and fails the job when it does not resolve.

## Landing page

`docs/index.html` is a single self-contained file with inline CSS and no scripts. `docs/.nojekyll` sits beside it so GitHub Pages serves the folder as is. The page uses the app's dark theme colors from `globals.css` (background `#171717`, surface `#0a0a0a`, line `#404040`, text `#ededed`, accent `#86efac`) and a system font stack.

Content, top to bottom:

- Heading "The Simple RFID Notekeeper" and the line "Scan a tag, keep a note. Everything stays in your browser."
- One paragraph: plug in a USB RFID reader, scan a tag, and the app opens a record for it. Add notes and templated fields such as owner, quantity, or in service. Every record, scan, and change is stored in the browser with IndexedDB, nothing leaves the machine, and the records can be exported and imported as JSON or CSV.
- A large Download button linking to `https://github.com/mjlemay/rfid-pouch-indexeddb/releases/latest/download/simple-rfid-notekeeper.zip`, with the caption "Latest release, zip of the static site" and a smaller link to all releases.
- "How to run it", a numbered list: download the zip; unzip it to get the `simple-rfid-notekeeper` folder; open `index.html` inside it in Chrome or Edge; plug in the USB RFID reader and scan; keep using the same browser on the same machine, because the data lives in that browser; use Import and Export to move records elsewhere.
- Footer: a link to the source on GitHub and the license name from the repository's `LICENSE` file.

The page is readable at phone width with a 16px side gutter and no horizontal scroll.

## GitHub Pages

Pages is set to the main branch, `/docs` folder, the same as blumbotron. The setting is applied once through `gh api repos/mjlemay/rfid-pouch-indexeddb/pages` with `build_type: legacy` and that source, or in the repository settings by hand. The site address is `https://mjlemay.github.io/rfid-pouch-indexeddb/`. The spec and plan markdown under `docs/superpowers` become browsable there too, which is acceptable for a public repository.

## README

A "Releases" section explains the flow: bump the version in `package.json`, merge to main, the workflow publishes `v<version>` with the zip, and the landing page's button always points at the latest. It links to the site.

## Testing and verification

- Run `npm run build && npm run package` locally and list the zip with `unzip -l` to confirm the single top-level folder, `index.html` inside it, and both file names.
- Parse all three workflow files as YAML with a one-line Node script using `js-yaml`, which is already in `node_modules`, to catch indentation mistakes before pushing.
- Open `docs/index.html` from the file system and check the content and the phone-width layout. The zip also carries `DIRECTIONS.md` from `public/`, which the build copies into `out/`; it is rewritten to use the new name and the same run steps as the landing page, and to say "USB RFID reader".
- After merge: the Actions run goes green, the release `v0.1.0` exists with both zips, `verify-downloads` passes, and the Pages URL serves the landing page.

## Out of scope

- Hosting the app itself on the site.
- Code signing, installers, or desktop builds.
- Automated changelog files beyond GitHub's generated release notes.
