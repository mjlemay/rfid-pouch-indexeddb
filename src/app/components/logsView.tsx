import React, { JSX, useEffect } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { createTheme, TableColumn } from 'react-data-table-component';

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
  })

  const dateSort = (a:DataRow, b:DataRow) => {
    console.log(a, b);
    const aDate = a.date || '';
    const bDate = b.date || '';
    return new Date(aDate).getTime() - new Date(bDate).getTime();
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
    }
  ];

  useEffect(()=>{
    if (docs) {
      console.log(docs);
    }
  },[docs])

  
  return (
    <div className=''
    >
      {error && JSON.stringify(error)}
      {loading && docs.length === 0 && <p>loading...</p>}
      <DataTable
        title="Scan Logs"
        columns={columns}
        data={docs as unknown as DataRow[]}
        keyField="date"
        defaultSortAsc={true}
        defaultSortFieldId="date"
        theme="dark"
      />
      {children}
    </div>
  )
}