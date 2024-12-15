'use client';

import PouchDB from "pouchdb-browser";
import { Provider as PouchProvider } from "use-pouchdb";
import find from "pouchdb-find";

PouchDB.plugin(find);

const db = new PouchDB('local');


export function Providers({ children }: Readonly<{
    children: React.ReactNode;
  }> ) {
  return (
         // @ts-expect-error provider is third party and isn't typed correctly
        <PouchProvider pouchdb={db}>
            <>{children}</>
        </PouchProvider>
  );
}