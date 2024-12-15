import { useCallback } from "react";
import { usePouch } from "use-pouchdb";

export function useAddScanRecord() {
  const db = usePouch();

  return useCallback(
    async (scanId:string) => {

      const doc = {
        _id: `scan_${new Date().toJSON()}`,
        type: 'scan',
        date: new Date().toJSON(),
        scanId: scanId || 'unknown',
      }

      const result = await db.post(doc);

      console.log('result', result); 
      return result
    },
    [db]
  )
}