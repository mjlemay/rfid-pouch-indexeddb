
# RFID - POUCH - INDEXEDDB

This is a [Next.js](https://nextjs.org) project that uses [PouchDB](https://pouchdb.com/) to store logs and notes on RFID scans via the [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) API built into web browsers.

This projects will generate a local folder with HTML / javaScript that they can distribute to allow people to share data.

## Getting Started

To build your distribute files:

```bash
npm install
```

then

```bash
npm run build
```

This will create a static build in the `out` folder. This folder is all you need! No additional commands required.

## Customizations 

To add your own tweaks, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Releases

Every push to `main` runs the Release workflow. It reads the version from `package.json` and, when no `v<version>` tag exists yet, builds the static site, zips it as `simple-rfid-notekeeper-<version>.zip` and `simple-rfid-notekeeper.zip`, and publishes a GitHub Release. To ship a new version, bump the version in `package.json` and merge to `main`.

The landing page at https://mjlemay.github.io/rfid-pouch-indexeddb/ always links to the latest zip. To build the zips locally, run `npm run build && npm run package`.

## Reminders

- As the data is stored via the browser, make sure you use the same browser each time!
- To move records to another browser or machine, download them from the Import and Export page as JSON or CSV and import the file there. New IDs are added and existing IDs are updated.
- The `#json` and `#csv` links at the bottom of that page open the same records as raw text in a new tab, for copying or saving straight from the browser.
- Tune the RFID timing values in Settings to match your RFID USB reader.
