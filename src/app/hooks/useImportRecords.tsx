import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';
import { TemplateDoc } from '../../utils/templates';
import { ImportDoc, ImportProblem, ImportResult, parseImportFile, planImport } from '../../utils/importExport';
import { useSaveRecord } from './useSaveRecord';

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 404;
}

// Imports a JSON or CSV file: creates templates the file names but the
// database lacks, then saves each good row through useSaveRecord so updates
// are diffed and logged like manual saves. Ends by writing one import summary
// document for the Activity feed. Nothing is written when the file itself
// cannot be read.
export function useImportRecords() {
  const db = usePouch();
  const saveRecord = useSaveRecord();

  return useCallback(async (fileName: string, text: string, templates: TemplateDoc[]): Promise<ImportResult> => {
    const parsed = parseImportFile(fileName, text);
    if (parsed.problems.length > 0) return { added: 0, updated: 0, skipped: 0, problems: parsed.problems };

    const plan = planImport(parsed.rows, templates, new Date().toJSON());
    const problems: ImportProblem[] = [...plan.problems];
    const allTemplates = [...templates, ...plan.newTemplates];
    let added = 0;
    let updated = 0;
    let skipped = plan.skipped;
    let index = 0;

    try {
      for (const template of plan.newTemplates) await db.put(template);
      for (; index < plan.writes.length; index++) {
        const write = plan.writes[index];
        let exists = true;
        try {
          await db.get(write.patch._id);
        } catch (error) {
          if (!isMissing(error)) throw error;
          exists = false;
        }
        const changes = await saveRecord(write.patch, allTemplates);
        if (!exists) added++;
        else if (changes.length > 0) updated++;
      }
    } catch {
      for (const remaining of plan.writes.slice(index)) {
        problems.push({ row: remaining.row, message: 'could not save' });
        skipped++;
      }
    }

    const date = new Date().toJSON();
    const summary: ImportDoc = { _id: `import_${date}`, type: 'import', date, fileName, added, updated, skipped };
    await db.put(summary);
    return { added, updated, skipped, problems };
  }, [db, saveRecord]);
}
