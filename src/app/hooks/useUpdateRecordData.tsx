import { useCallback } from "react";
import { usePouch } from "use-pouchdb";

interface keyable {
  [key: string]: string | undefined;
}

export function useAddUpdateRecordData() {
  const db = usePouch();

  return useCallback(
    async ( payload:{ [key: string]: string }) => {
      console.log(payload._id);
        const lastDoc:keyable = {};
        const getDoc = () => {
          return db.get(payload._id);
        }
        getDoc().then((result) => {
          console.log('result', result);
        });
        const _rev = lastDoc._rev;
        const doc = { 
            _rev,
            ...payload
        };
        const update = async () => {
            try {
                await db.put(doc);
              } catch (error) {
                if (JSON.stringify(error).includes('conflict')) {
                  update(); // There was a conflict, try again.
                } else {
                  console.log('UPDATE error', error);
                }
              }
        }
        const result = update();
        return result;
    },
    [db]
  )
}