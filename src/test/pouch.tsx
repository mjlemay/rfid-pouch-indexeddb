import 'fake-indexeddb/auto';
import React from 'react';
import PouchDB from 'pouchdb-browser';
import find from 'pouchdb-find';
import { Provider } from 'use-pouchdb';

PouchDB.plugin(find);

// A fresh database per call so tests never share state.
export function makeTestDatabase(): PouchDB.Database {
  return new PouchDB(`test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

export function withPouch(db: PouchDB.Database) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider pouchdb={db}>{children as React.ReactElement}</Provider>;
  };
}
