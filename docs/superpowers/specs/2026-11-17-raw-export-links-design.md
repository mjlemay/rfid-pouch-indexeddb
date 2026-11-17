# Raw export links

Date: 2026-11-17

Extends `2026-11-16-import-export-design.md`.

## Goal

Add two links at the bottom of the Import and Export page, `#json` and `#csv`, that open the app in a new tab showing nothing but the exported records as raw JSON or CSV text, so the data can be read, copied, or saved straight from a browser tab.

## Decisions

- The links open a new tab. The app the user is looking at stays as it is.
- The app is a single static page with no server, so the hash is handled in the browser. The page reads the URL hash on load, and when it is `#json` or `#csv` it renders only the raw text in place of the sidebar, top bar, and views.
- The raw text is exactly what the Download button would produce for that format, built with the same `exportRows`, `recordsToJson`, and `recordsToCsv` functions.
- The raw tab's title is the export file name the Download button would use, so Save As suggests the same name.

## Links

Below the two cards on the Import and Export page, one line of caption text reads "Raw: #json · #csv". Each hash is an anchor:

```html
<a href="#json" target="_blank" rel="noopener" class="underline">#json</a>
```

The caption uses the existing caption style (`text-lg opacity-70`), and the anchors are underlined in the page text color.

## Reading the hash

A hook `useRawFormat()` in `src/app/hooks/useRawFormat.tsx` returns `'json'`, `'csv'`, or `null`. It uses `useSyncExternalStore` so the server snapshot during static prerendering is `null` and the browser snapshot is read from `window.location.hash` without a hydration mismatch. It subscribes to `hashchange` so a tab that changes its own hash updates.

The pure helper `rawFormatFromHash(hash)` maps `#json` and `#csv`, case-insensitive, to the format and anything else, including an empty string, to `null`. It is exported for tests.

## Page selection

`page.tsx` keeps the existing component, now named `Home`, and gains a new default export `Page` that calls `useRawFormat()` and renders `RawExportView` when a format is present, otherwise `Home`. Because `Home` is not rendered in raw mode, none of its hooks run: the title is not pushed into the tab, the theme attribute is not set, and the USB RFID reader listener is not attached.

## Raw view

`src/app/components/rawExportView.tsx` takes one prop, `format`. It reads the settings document with `useDoc('app_settings')` for the title (falling back to `DEFAULT_APPEARANCE` when missing), the templates with `useTemplates()`, and the records with the same `useFind` query the Import and Export page uses. Until all three have loaded it renders nothing. Then it renders one `<pre>` with the text for the format, in monospace, black on white, filling the viewport, with text selection allowed. When the text is ready it sets `document.title` to `exportFileName(title, format, new Date())`.

## Testing

- `useRawFormat.test.tsx`: `rawFormatFromHash` for `#json`, `#CSV`, `#other`, and `''`; the hook reads the current hash and updates on `hashchange`.
- `rawExportView.test.tsx` with the fake database: JSON output matches the export rows, CSV output has the header and row, the tab title is the export file name using the stored title, and a missing settings document falls back to the default title.
- `importExportView.test.tsx`: both links exist, point at `#json` and `#csv`, and open in a new tab.
- `page.test.tsx`: with the hash set to `#csv`, the page shows the CSV text and no sidebar.
- `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.

## Out of scope

- Serving the file with a real `Content-Type`. A static page cannot change its own response headers.
- Other hashes, such as a per-record view.
