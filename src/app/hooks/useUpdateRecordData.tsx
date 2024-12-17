import { useCallback } from "react";
import { usePouch } from "use-pouchdb";

export function useAddUpdateRecordData() {
  const db = usePouch();

  return useCallback(
    async ( payload:{ [key: string]: string }) => {
        const lastDoc = await db.get(payload._id);
        const doc = { 
            _rev: lastDoc._rev,
            ...payload
        };
        const update = async () => {
            try {
                await db.put(doc) // And put the new version into the database.
              } catch (error) {
                if (JSON.stringify(error).includes('conflict')) {
                  update(); // There was a conflict, try again.
                } else {
                  console.log(error) // Handle other errors.
                }
              }
        }
        const result = update();
        return result;
    },
    [db]
  )
}