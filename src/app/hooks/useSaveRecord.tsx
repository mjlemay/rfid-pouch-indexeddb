import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';
import { ChangeDoc, diffRecord, FieldValue, RecordDoc, TemplateDoc } from '../../utils/templates';

export type RecordPatch = {
  _id: string;
  Notes?: string;
  templateId?: string;
  data?: Record<string, FieldValue>;
};

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'conflict';
}

// Saves a record's Notes, template and field values, and writes one change
// document listing what differed. Stored data for fields not in the patch is
// kept. An empty templateId clears the template.
export function useSaveRecord() {
  const db = usePouch();

  return useCallback(async (patch: RecordPatch, templates: TemplateDoc[]) => {
    const write = async () => {
      let before: RecordDoc | undefined;
      try {
        before = await db.get<RecordDoc>(patch._id);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }

      const after: RecordDoc = {
        ...(before ?? { _id: patch._id, type: 'record' }),
        _id: patch._id,
        type: 'record',
      };
      if (patch.Notes !== undefined) after.Notes = patch.Notes;
      if (patch.templateId !== undefined) {
        if (patch.templateId === '') delete after.templateId;
        else after.templateId = patch.templateId;
      }
      if (patch.data) after.data = { ...(before?.data ?? {}), ...patch.data };

      const changes = diffRecord(before, after, templates);
      await db.put(after);
      if (changes.length > 0) {
        const date = new Date().toJSON();
        const change: ChangeDoc = { _id: `change_${date}_${patch._id}`, type: 'change', scanId: patch._id, date, changes };
        await db.put(change);
      }
      return changes;
    };

    try {
      return await write();
    } catch (error) {
      if (!isConflict(error)) throw error;
      return write();
    }
  }, [db]);
}
