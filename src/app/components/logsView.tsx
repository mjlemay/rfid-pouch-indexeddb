import React, { JSX, useEffect } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { TableColumn } from 'react-data-table-component';
import { DATA_TABLE_THEME } from '../../utils/dataTableTheme';

const LOG_LIMIT = 1000;

interface LogsViewProps {
  children?: React.ReactNode;
  actionHandler?: (arg0: string) => void;
  selectRowHandler?: (arg0: string) => void;
}

interface DataRow {
  date?: string;
  scanId?: string;
}


export default function LogsView(props:LogsViewProps):JSX.Element {
  const { children, selectRowHandler = ()=>{} } = props;
  
  const { docs, loading, error } = useFind({
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
      style: {'cursor':'pointer'}
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

  useEffect(() =>{
    console.log('error', error)
  },[error])

  
  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        
        <h1 className="font-medium text-4xl">Scan Logs</h1>
        {loading && docs.length === 0 && <p>loading...</p>}
        {docs.length >= 1 && (<DataTable
          columns={columns}
          data={docs as unknown as DataRow[]}
          onRowClicked={(row:DataRow)=>{selectRowHandler(row.scanId as string)}}
          keyField="date"
          defaultSortFieldId="date"
          theme={DATA_TABLE_THEME}
          pagination
        />)}
        {children}
      </div>
    </div>
  )
}