import React, { JSX, useEffect } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';
import FormViewer from './formViewer';
import DataTable, { createTheme, TableColumn } from 'react-data-table-component';

type Doc = PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;

interface docItem extends Doc {
  name?: string | null;
}

interface IdsViewProps {
  children?: React.ReactNode;
  actionHandler?: (arg0: string) => void;
  selectedId: string;
}

interface DataRow {
  [key: string]: string
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
  

  const RECORD_LIMIT = 1000;

  const defaultFields = [{name: "Notes", inputType: "text", fieldType: "textarea"}]
  
  export default function IdsView(props:IdsViewProps):JSX.Element {
    const { children, selectedId = '' } = props;
    const addUpdateRecordData = useAddUpdateRecordData();
    const hasSelectedId = selectedId !== '';
    const { doc, loading, state, error } = useDoc(selectedId);
    const { name = '', _id } = doc as docItem || {};
    const defaultRecordFields = defaultFields.map(item => item.name);
    defaultRecordFields.unshift('_id');
    const { docs, loading:docsLoading, error:docsError } = useFind({
      index: {
        fields: ['type'],
      },
      selector: {
        type: 'record',
      },
      fields: defaultRecordFields,
      limit: RECORD_LIMIT,
    })

    const columns: TableColumn<DataRow>[] = [
      {
        name: 'ID',
        selector: row => row._id || '',
        sortable: true,
      },
      {
        name: 'Notes',
        selector: row => row.Notes || '',
        grow: 12,
      }
    ];

    const handleRecordUpdate = (payload:{ [key: string]: string }) => {
      addUpdateRecordData(payload);
    }

    useEffect(()=>{
      if (error) {
        const errorString = JSON.stringify(error);
        console.log('err', state, error);
        if (errorString.includes('404')) {
          // create a new record if one does not exist
          addUpdateRecordData({_id: selectedId});
        }
      }
    },[addUpdateRecordData, error, selectedId, state]);

    useEffect(()=>{
      console.log('selectedId', selectedId);
    },[selectedId])
  
    return (
      <div className='flex flex-col h-full w-full'
      >
        <div className='border border-neutral-800 bg-gradient-to-b from-black border-1 grow rounded-lg p-4 m-10 h-full'>
          {!loading && doc && (
            <>
              <h1 className="font-medium text-3xl">Details for {doc && name}({_id})</h1>
              <FormViewer formDoc={doc} fields={defaultFields} formActionHandler={handleRecordUpdate} />
            </>
          )}
          {!hasSelectedId && (
            <div className={`flex flex-1 items-center justify-center`}>
              <p>No ID selected.</p>
            </div>
          )}
        </div>
        <div className='grow p-4 m-10 h-full'>
        <h1 className="font-medium text-4xl">Records</h1>
        {docsLoading && docs.length === 0 && <p>loading...</p>}
        {docsError && JSON.stringify(docsError)}
        {docs.length >= 1 && (<DataTable
          columns={columns}
          data={docs as unknown as DataRow[]}
          keyField="date"
          defaultSortFieldId="date"
          theme="dark"
          pagination
        />)}
          {children}
        </div>
      </div>
    )
  }