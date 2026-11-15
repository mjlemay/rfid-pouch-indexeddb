'use client';

import PouchDB from "pouchdb-browser";
import { Provider } from "use-pouchdb";
import find from "pouchdb-find";

PouchDB.plugin(find);

const db = new PouchDB('local');

export default function pouchDbProvider({ children }: Readonly<{
    children: React.ReactNode;
  }> ) {
  return (
        <Provider pouchdb={db}>
            <>{children}</>
        </Provider>
  );
}