import React, { JSX, useMemo } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { TableColumn } from 'react-data-table-component';
import { DATA_TABLE_STYLES, DATA_TABLE_THEME } from '../../utils/dataTableTheme';
import { RecordChange } from '../../utils/templates';
import { describeImport, ImportDoc } from '../../utils/importExport';

interface LogsViewProps {
  children?: React.ReactNode;
  limit?: number;
  actionHandler?: (arg0: string) => void;
  selectRowHandler?: (arg0: string) => void;
}

interface FeedRow {
  _id: string;
  type: 'scan' | 'change' | 'import';
  scanId?: string;
  date: string;
  changes?: RecordChange[];
  fileName?: string;
  added?: number;
  updated?: number;
  skipped?: number;
}

const EVENT_LABELS: Record<FeedRow['type'], string> = { scan: 'Scan', change: 'Updated', import: 'Import' };

function asImportDoc(row: FeedRow): ImportDoc {
  return { _id: row._id, type: 'import', date: row.date, fileName: row.fileName ?? '', added: row.added ?? 0, updated: row.updated ?? 0, skipped: row.skipped ?? 0 };
}

function describeChange(change: RecordChange): string {
  return `${change.field}: ${change.from} → ${change.to}`;
}

// One feed of scans, record changes and imports, newest first.
export default function LogsView(props:LogsViewProps):JSX.Element {
  const { children, limit = 1000, selectRowHandler = ()=>{} } = props;

  const { docs, loading } = useFind({
    index: { fields: ['type'] },
    selector: { type: { $in: ['scan', 'change', 'import'] } },
    fields: ['_id', 'type', 'scanId', 'date', 'changes', 'fileName', 'added', 'updated', 'skipped'],
    limit,
  });

  const rows = useMemo(
    () => [...(docs as unknown as FeedRow[])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [docs],
  );

  const columns: TableColumn<FeedRow>[] = [
    { name: 'Tag', selector: row => row.scanId || '', sortable: true, style: {'cursor':'pointer'}, minWidth: '140px', grow: 0 },
    { name: 'Event', selector: row => EVENT_LABELS[row.type], minWidth: '120px', grow: 0 },
    {
      name: 'Details',
      cell: row => (
        <div className="py-1">
          {row.type === 'import' && <div>{describeImport(asImportDoc(row))}</div>}
          {(row.changes ?? []).map((change, index) => (<div key={index}>{describeChange(change)}</div>))}
        </div>
      ),
      grow: 12,
    },
    {
      name: 'Date',
      selector: row => row.date || '',
      sortable: true,
      format: row => row.date && new Date(row.date).toLocaleString(),
      right: true,
      minWidth: '260px',
      grow: 0,
    }
  ];

  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        <h1 className="font-medium text-4xl">Activity</h1>
        {loading && rows.length === 0 && <p>loading...</p>}
        {rows.length >= 1 && (<DataTable
          columns={columns}
          data={rows}
          onRowClicked={(row:FeedRow)=>{ if (row.type !== 'import' && row.scanId) selectRowHandler(row.scanId); }}
          keyField="_id"
          theme={DATA_TABLE_THEME}
          customStyles={DATA_TABLE_STYLES}
          pagination
        />)}
        {!loading && rows.length === 0 && <p>No activity yet.</p>}
        {children}
      </div>
    </div>
  )
}
