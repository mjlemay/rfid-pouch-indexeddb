import React, { JSX, useEffect } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { createTheme } from 'react-data-table-component';

interface LogsViewProps {
    children?: React.ReactNode;
    actionHandler?: (arg0: string) => void;
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

  const sortbyDate = (a:string, b:string) => {
    return new Date(b.date) - new Date(a.date);
  }

  const columns = [{
    name: 'scanId',
    selector: (row:any) => row.scanId,
    sortable: true,
  },
  {
    name: 'Date',
    selector: (row:any) => row.date,
    sortable: true,
    sortFunction: sortbyDate,
    format: (row:any) => new Date(row.date).toLocaleString(),
    grow: 12,
  }];

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
        data={docs}
        keyField="date"
        defaultSortFieldId="date"
        theme="dark"
      />
      {children}
    </div>
  )
}