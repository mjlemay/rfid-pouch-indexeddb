import { useCallback, useMemo } from 'react';
import { useFind, usePouch } from 'use-pouchdb';
import { TemplateDoc } from '../../utils/templates';
import { useSaveDocument } from './useSaveDocument';

// Every template, sorted by name, with save and delete helpers.
export function useTemplates() {
  const db = usePouch();
  const saveDocument = useSaveDocument();
  const { docs, loading } = useFind({
    index: { fields: ['type'] },
    selector: { type: 'template' },
  });

  const templates = useMemo(
    () => [...(docs as unknown as TemplateDoc[])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [docs],
  );

  const saveTemplate = useCallback(async (template: TemplateDoc) => {
    await saveDocument({ ...template, updatedAt: new Date().toJSON() });
  }, [saveDocument]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    const current = await db.get(templateId);
    await db.remove(current);
  }, [db]);

  return { templates, loading, saveTemplate, deleteTemplate };
}
