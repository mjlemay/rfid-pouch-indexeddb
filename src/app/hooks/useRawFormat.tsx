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
