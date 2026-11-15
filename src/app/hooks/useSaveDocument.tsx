import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';

type AnyDoc = { _id: string; _rev?: string } & Record<string, unknown>;

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'conflict';
}

// Reads the current document, merges the given fields over it, and writes
// once. The caller's _rev is ignored in favor of the stored one. On a write
// conflict it re-reads and retries once, then throws.
export function useSaveDocument() {
  const db = usePouch();

  return useCallback(async (patch: AnyDoc) => {
    const write = async () => {
      let current: AnyDoc = { _id: patch._id };
      try {
        current = await db.get<AnyDoc>(patch._id);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
      const { _rev: ignoredRev, ...fields } = patch;
      void ignoredRev;
      const next: AnyDoc = { ...current, ...fields, _id: patch._id, _rev: current._rev };
      if (!next._rev) delete next._rev;
      return db.put(next);
    };

    try {
      return await write();
    } catch (error) {
      if (!isConflict(error)) throw error;
      return write();
    }
  }, [db]);
}
