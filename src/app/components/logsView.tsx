import React, { JSX, useMemo } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { TableColumn } from 'react-data-table-component';
import { DATA_TABLE_STYLES, DATA_TABLE_THEME } from '../../utils/dataTableTheme';
import { RecordChange } from '../../utils/templates';

interface LogsViewProps {
  children?: React.ReactNode;
  limit?: number;
  actionHandler?: (arg0: string) => void;
  selectRowHandler?: (arg0: string) => void;
}

interface FeedRow {
  _id: string;
  type: 'scan' | 'change';
  scanId: string;
  date: string;
  changes?: RecordChange[];
}

function describeChange(change: RecordChange): string {
  return `${change.field}: ${change.from} → ${change.to}`;
}

// One feed of scans and record changes, newest first.
export default function LogsView(props:LogsViewProps):JSX.Element {
  const { children, limit = 1000, selectRowHandler = ()=>{} } = props;

  const { docs, loading } = useFind({
    index: { fields: ['type'] },
    selector: { type: { $in: ['scan', 'change'] } },
    fields: ['_id', 'type', 'scanId', 'date', 'changes'],
    limit,
  });

  const rows = useMemo(
    () => [...(docs as unknown as FeedRow[])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [docs],
  );

  const columns: TableColumn<FeedRow>[] = [
    { name: 'Tag', selector: row => row.scanId || '', sortable: true, style: {'cursor':'pointer'}, minWidth: '140px', grow: 0 },
    { name: 'Event', selector: row => (row.type === 'scan' ? 'Scan' : 'Updated'), minWidth: '120px', grow: 0 },
    {
      name: 'Details',
      cell: row => (
        <div className="py-1">
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
          onRowClicked={(row:FeedRow)=>{selectRowHandler(row.scanId)}}
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
