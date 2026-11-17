import React, { JSX, useEffect, useMemo } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useTemplates } from '../hooks/useTemplates';
import { RecordDoc } from '../../utils/templates';
import { appearanceFromSettings, DEFAULT_APPEARANCE } from '../../utils/themes';
import {
  ExportFormat,
  exportFieldColumns,
  exportFileName,
  exportRows,
  recordsToCsv,
  recordsToJson,
} from '../../utils/importExport';

interface RawExportViewProps {
  format: ExportFormat;
}

// The whole page as one block of text, for the #json and #csv links. It is what
// the Download button would have saved, shown in a tab instead of a file.
export default function RawExportView({ format }: RawExportViewProps): JSX.Element | null {
  const { doc: settingsDoc, loading: settingsLoading } = useDoc('app_settings');
  const { templates, loading: templatesLoading } = useTemplates();
  const { docs, loading: recordsLoading } = useFind({ index: { fields: ['type'] }, selector: { type: 'record' } });
  const ready = !settingsLoading && !templatesLoading && !recordsLoading;
  const title = appearanceFromSettings(settingsDoc as Record<string, unknown> | null, DEFAULT_APPEARANCE).title;

  const text = useMemo(() => {
    if (!ready) return '';
    const rows = exportRows(docs as unknown as RecordDoc[], templates);
    return format === 'json' ? recordsToJson(rows) : recordsToCsv(rows, exportFieldColumns(templates));
  }, [docs, format, ready, templates]);

  useEffect(() => {
    if (ready) document.title = exportFileName(title, format, new Date());
  }, [format, ready, title]);

  if (!ready) return null;
  return <pre className="m-0 min-h-screen w-full p-4 bg-white text-black font-mono text-sm whitespace-pre overflow-auto select-text">{text}</pre>;
}
