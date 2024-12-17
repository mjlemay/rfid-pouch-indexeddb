import React, { JSX } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { createTheme, TableColumn } from 'react-data-table-component';

const LOG_LIMIT = 1000;

interface LogsViewProps {
  children?: React.ReactNode;
  actionHandler?: (arg0: string) => void;
}

interface DataRow {
  date?: string;
  scanId?: string;
}

createTheme('dark', {
  text: {
    primary: '#fff',
    secondary: '#fff',
  },
  background: {
    default: 'rgba(0,0,0,0)',
  },
  context: {
    background: 'rgba(255,255,255,.5)',
    text: '#fff',
  },
  divider: {
    default: 'rgba(255,255,255,.25)',
  },
  action: {
    button: 'rgba(0,0,0,.54)',
    hover: 'rgba(0,0,0,.08)',
    disabled: 'rgba(0,0,0,.12)',
  },
});

export default function LogsView(props:LogsViewProps):JSX.Element {
  const { children } = props;
  
  const { docs, loading, error } = useFind({
    // Ensure that this index exist, create it if not. And use it.
    index: {
      fields: ['type'],
    },
    selector: {
      type: 'scan',
    },
    fields: ['scanId', 'date'],
    limit: LOG_LIMIT,
  })

  const dateSort = (a:DataRow, b:DataRow) => {
    const aDate = new Date (a.date || '');
    const bDate = new Date(b.date || '');
    return aDate.getTime() - bDate.getTime();
  }

  const columns: TableColumn<DataRow>[] = [
    {
      name: 'scanId',
      selector: row => row.scanId || '',
      sortable: true,
    },
    {
      name: 'Date',
      selector: row => row.date || '',
      sortFunction: dateSort,
      sortable: true,
      format: row => row.date && new Date(row.date).toLocaleString(),
      grow: 12,
      right: true,
    }
  ];
  
  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        {error && JSON.stringify(error)}
        {loading && docs.length === 0 && <p>loading...</p>}
        
        <h1 className="font-medium text-4xl">Scan Logs</h1>
        <DataTable
          columns={columns}
          data={docs as unknown as DataRow[]}
          keyField="date"
          defaultSortFieldId="date"
          theme="dark"
          pagination
        />
        {children}
      </div>
    </div>
  )
}