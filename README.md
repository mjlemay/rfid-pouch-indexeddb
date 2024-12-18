
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

To add your own tweaks, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Reminders

- As the data is stored via the browser, make sure you use the same browser each time!
- For better performance, make sure you update the settings the mode for your read/writer device in settings.


