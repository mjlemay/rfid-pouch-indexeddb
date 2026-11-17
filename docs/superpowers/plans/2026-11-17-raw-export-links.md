# Raw Export Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `#json` and `#csv` links to the Import and Export page that open the app in a new tab showing only the exported records as raw text.

**Architecture:** A hook `useRawFormat` reads the URL hash through `useSyncExternalStore`. The page's default export becomes a tiny `Page` that renders `RawExportView` when the hash names a format and the existing `Home` otherwise, so none of the app's hooks run in the raw tab. `RawExportView` reuses the export functions from `src/utils/importExport.ts` and renders one `<pre>`.

**Tech Stack:** Next.js 15 static export, React 19, TypeScript, Tailwind 3, PouchDB via use-pouchdb, vitest 5 with jsdom, @testing-library/react, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-17-raw-export-links-design.md`

**Branch:** `feat/import-export` (PR #6, already open). These tasks land as additional commits.

**Conventions:** Run tests with `npx vitest run <path>`. Commit only when Mertie confirms; each task ends with a proposed commit message. No HTML in comments. American spelling. No abbreviated names. No jest-dom matchers are installed, so check properties such as `.disabled` and attributes with `getAttribute`.

---

## File structure

- Create `src/app/hooks/useRawFormat.tsx` and `useRawFormat.test.tsx`: hash to format.
- Create `src/app/components/rawExportView.tsx` and `rawExportView.test.tsx`: the raw text page.
- Modify `src/app/components/importExportView.tsx` and its test: the two links.
- Modify `src/app/page.tsx` and `page.test.tsx`: `Page` wrapper that picks the raw view.
- Modify `README.md`: one line about the raw links.

---

### Task 1: The hash hook

**Files:**
- Create: `src/app/hooks/useRawFormat.tsx`
- Test: `src/app/hooks/useRawFormat.test.tsx`

- [x] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { rawFormatFromHash, useRawFormat } from './useRawFormat';

afterEach(() => { window.history.replaceState(null, '', window.location.pathname); });

describe('rawFormatFromHash', () => {
  test('maps #json and #csv to formats ignoring case', () => {
    expect(rawFormatFromHash('#json')).toBe('json');
    expect(rawFormatFromHash('#CSV')).toBe('csv');
  });

  test('returns null for other hashes and no hash', () => {
    expect(rawFormatFromHash('#other')).toBeNull();
    expect(rawFormatFromHash('')).toBeNull();
  });
});

describe('useRawFormat', () => {
  test('reads the current hash', () => {
    window.location.hash = '#csv';
    const { result } = renderHook(() => useRawFormat());
    expect(result.current).toBe('csv');
  });

  test('updates when the hash changes', () => {
    const { result } = renderHook(() => useRawFormat());
    expect(result.current).toBeNull();
    act(() => {
      window.location.hash = '#json';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe('json');
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/hooks/useRawFormat.test.tsx`
Expected: FAIL, cannot find module `./useRawFormat`.

- [x] **Step 3: Implement**

```tsx
import { useSyncExternalStore } from 'react';
import { ExportFormat } from '../../utils/importExport';

// The app is one static page, so a raw export is asked for with a URL hash.
export function rawFormatFromHash(hash: string): ExportFormat | null {
  const name = hash.replace(/^#/, '').toLowerCase();
  if (name === 'json' || name === 'csv') return name;
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): ExportFormat | null {
  return rawFormatFromHash(window.location.hash);
}

// Null during static prerendering, so the page hydrates without a mismatch and
// then switches to the raw view once the browser hash is read.
function serverSnapshot(): ExportFormat | null {
  return null;
}

export function useRawFormat(): ExportFormat | null {
  return useSyncExternalStore(subscribe, readHash, serverSnapshot);
}
```

- [x] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/hooks/useRawFormat.test.tsx`
Expected: 4 passed.

- [x] **Step 5: Propose commit**

`Add a hook that reads the raw export format from the URL hash`

---

### Task 2: The raw export view

**Files:**
- Create: `src/app/components/rawExportView.tsx`
- Test: `src/app/components/rawExportView.test.tsx`

- [x] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import RawExportView from './rawExportView';
import { createField, createTemplate, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };
const STAMP = '\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}';

describe('RawExportView', () => {
  let db: PouchDB.Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: 'b2', type: 'record', Notes: 'spare', templateId: 'template_asset', data: { f_owner: 'Sam' } });
  });

  afterEach(async () => {
    document.title = '';
    await db.destroy();
  });

  test('shows the records as JSON and names the tab after the stored title', async () => {
    await db.put({ _id: 'app_settings', type: 'setting', TITLE: 'Lab Tags' });
    render(<RawExportView format="json" />, { wrapper: withPouch(db) });
    const pre = await screen.findByText(/"id": "b2"/);
    expect(pre.tagName).toBe('PRE');
    expect(JSON.parse(pre.textContent ?? '')).toEqual([{ id: 'b2', template: 'Asset Tag', notes: 'spare', fields: { Owner: 'Sam' } }]);
    await waitFor(() => expect(document.title).toMatch(new RegExp(`^lab-tags-records-${STAMP}\\.json$`)));
  });

  test('shows the records as CSV', async () => {
    render(<RawExportView format="csv" />, { wrapper: withPouch(db) });
    const pre = await screen.findByText(/^ID,Template,Notes,Owner/);
    expect(pre.textContent).toBe('ID,Template,Notes,Owner\r\nb2,Asset Tag,spare,Sam\r\n');
  });

  test('falls back to the default title when there are no settings', async () => {
    render(<RawExportView format="csv" />, { wrapper: withPouch(db) });
    await screen.findByText(/^ID,Template,Notes,Owner/);
    await waitFor(() => expect(document.title).toMatch(new RegExp(`^rfid-scans-records-${STAMP}\\.csv$`)));
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/components/rawExportView.test.tsx`
Expected: FAIL, cannot find module `./rawExportView`.

- [x] **Step 3: Implement**

```tsx
import React, { JSX, useEffect, useMemo } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useTemplates } from '../hooks/useTemplates';
import { RecordDoc } from '../../utils/templates';
import { appearanceFromSettings, DEFAULT_APPEARANCE } from '../../utils/themes';
import {
  ExportFormat,
  exportFieldColumns,
  exportFileName,
  exportRows,
  recordsToCsv,
  recordsToJson,
} from '../../utils/importExport';

interface RawExportViewProps {
  format: ExportFormat;
}

// The whole page as one block of text, for the #json and #csv links. It is what
// the Download button would have saved, shown in a tab instead of a file.
export default function RawExportView({ format }: RawExportViewProps): JSX.Element | null {
  const { doc: settingsDoc, loading: settingsLoading } = useDoc('app_settings');
  const { templates, loading: templatesLoading } = useTemplates();
  const { docs, loading: recordsLoading } = useFind({ index: { fields: ['type'] }, selector: { type: 'record' } });
  const ready = !settingsLoading && !templatesLoading && !recordsLoading;
  const title = appearanceFromSettings(settingsDoc as Record<string, unknown> | null, DEFAULT_APPEARANCE).title;

  const text = useMemo(() => {
    if (!ready) return '';
    const rows = exportRows(docs as unknown as RecordDoc[], templates);
    return format === 'json' ? recordsToJson(rows) : recordsToCsv(rows, exportFieldColumns(templates));
  }, [docs, format, ready, templates]);

  useEffect(() => {
    if (ready) document.title = exportFileName(title, format, new Date());
  }, [format, ready, title]);

  if (!ready) return null;
  return <pre className="m-0 min-h-screen w-full p-4 bg-white text-black font-mono text-sm whitespace-pre overflow-auto select-text">{text}</pre>;
}
```

- [x] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/components/rawExportView.test.tsx`
Expected: 3 passed.

- [x] **Step 5: Propose commit**

`Add the raw export view`

---

### Task 3: The links on the Import and Export page

**Files:**
- Modify: `src/app/components/importExportView.tsx`
- Test: `src/app/components/importExportView.test.tsx`

- [x] **Step 1: Write the failing test** (append inside the `describe`)

```tsx
  test('links to the raw JSON and CSV views in a new tab', async () => {
    await renderView();
    for (const format of ['json', 'csv']) {
      const link = screen.getByRole('link', { name: `#${format}` });
      expect(link.getAttribute('href')).toBe(`#${format}`);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/components/importExportView.test.tsx`
Expected: FAIL, unable to find role link with name `#json`.

- [x] **Step 3: Implement** (after the Import `</section>`, before `{children}`)

```tsx
      <p className="text-lg opacity-70">
        Raw:{' '}
        {EXPORT_FORMAT_OPTIONS.map((option, index) => (
          <React.Fragment key={option.value}>
            {index > 0 && ' · '}
            <a href={`#${option.value}`} target="_blank" rel="noopener" className="underline">#{option.value}</a>
          </React.Fragment>
        ))}
      </p>
```

- [x] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/components/importExportView.test.tsx`
Expected: 5 passed.

- [x] **Step 5: Propose commit**

`Link to the raw JSON and CSV views from the Import and Export page`

---

### Task 4: Pick the raw view from the hash in the page

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

- [x] **Step 1: Write the failing test** (append at the end of the file)

```tsx
describe('Raw export by hash', () => {
  let db: PouchDB.Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({ _id: 'b2', type: 'record', Notes: 'spare', templateId: '', data: {} });
    window.location.hash = '#csv';
  });

  afterEach(async () => {
    window.history.replaceState(null, '', window.location.pathname);
    await db.destroy();
  });

  test('a #csv hash shows only the CSV text', async () => {
    render(<Home />, { wrapper: withPouch(db) });
    const pre = await screen.findByText(/^ID,Template,Notes/);
    expect(pre.textContent).toBe('ID,Template,Notes\r\nb2,,spare\r\n');
    expect(document.querySelector('.bg-sidebar')).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/page.test.tsx`
Expected: the new test FAILS, unable to find text matching `ID,Template,Notes`; existing tests still pass.

- [x] **Step 3: Implement**

In `src/app/page.tsx` add the imports:

```tsx
import RawExportView from './components/rawExportView';
import { useRawFormat } from './hooks/useRawFormat';
```

Change `export default function Home() {` to `function Home() {` and add at the end of the file:

```tsx
// A #json or #csv hash shows the raw export instead of the app, so none of the
// app's hooks run in that tab.
export default function Page() {
  const rawFormat = useRawFormat();
  if (rawFormat) return <RawExportView format={rawFormat} />;
  return <Home />;
}
```

- [x] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/page.test.tsx`
Expected: all passed, including the new test.

- [x] **Step 5: Propose commit**

`Show the raw export when the page loads with a #json or #csv hash`

---

### Task 5: Verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-17-raw-export-links.md` (tick boxes)

- [x] **Step 1: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all tests pass, no type errors, no lint errors, static export succeeds.

- [x] **Step 2: README**

After the existing Import and Export line, add:

```
The `#json` and `#csv` links at the bottom of that page open the same records as raw text in a new tab, for copying or saving straight from the browser.
```

- [ ] **Step 3: Live check (Mertie)**

Open the Import and Export page, click `#json` and `#csv`, confirm each opens a new tab with only the text and that the tab title is the export file name.

- [x] **Step 4: Propose commit**

`Document the raw export links`
