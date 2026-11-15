import React, { JSX, useEffect } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useSaveDocument } from '../hooks/useSaveDocument';
import FormViewer from './formViewer';
import DataTable, { TableColumn } from 'react-data-table-component';
import { DATA_TABLE_THEME } from '../../utils/dataTableTheme';
import { formValues, pouchDocItem } from '@/utils/types';

interface IdsViewProps {
  children?: React.ReactNode;
  limit?: number;
  selectRowHandler?:(arg0: string) => void;
  inputFocusHandler?:(arg0?:boolean) => void;
  selectedId: string;
}

interface DataRow {
  [key: string]: string
}

  


  const defaultFields = [{name: "Notes", inputType: "text", fieldType: "textarea"}]
  
  export default function IdsView(props:IdsViewProps):JSX.Element {
    const { children, selectedId = '', limit, inputFocusHandler = ()=>{}, selectRowHandler = ()=>{} } = props;
    const saveDocument = useSaveDocument();
    const hasSelectedId = selectedId !== '';
    const { doc, loading, state, error } = useDoc(selectedId);
    const { name = '', _id } = doc as pouchDocItem || {};
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
      limit,
    })

    const columns: TableColumn<DataRow>[] = [
      {
        name: 'ID',
        selector: row => row._id || '',
        sortable: true,
        style: {'cursor':'pointer'},
      },
      {
        name: 'Notes',
        selector: row => row.Notes || '',
        grow: 12,
      }
    ];

    const handleRecordUpdate = (payload: formValues, callback: (arg0: boolean) => void) => {
      saveDocument({ ...payload, _id: selectedId, type: 'record' });
      setTimeout(()=>{
        callback(false);
      }, 200);
    }

    useEffect(()=>{
      if (error) {
        const errorString = JSON.stringify(error);
        console.log('err', state, error);
        if (errorString.includes('404')) {
          // create a new record if one does not exist
          saveDocument({ _id: selectedId, type: 'record' });
        }
      }
    },[saveDocument, error, selectedId, state]);

    useEffect(()=>{
      console.log('selectedId', selectedId);
    },[selectedId])
  
    return (
      <div className='flex flex-col h-full w-full'
      >
        <div className='border border-line bg-surface grow rounded-lg p-4 m-10 h-full'>
          {!loading && doc && (
            <>
              <h1 className="font-medium text-3xl">Details for {doc && name}({_id})</h1>
              <FormViewer 
                formDoc={doc}
                fields={defaultFields}
                inputFocusHandler={inputFocusHandler}
                formActionHandler={handleRecordUpdate}
                />
            </>
          )}
          {!hasSelectedId && (
            <div className={`flex flex-1 items-center justify-center`}>
              <p>No ID selected.</p>
            </div>
          )}
        </div>
        <div className='grow p-4 m-10'>
        <h1 className="font-medium text-4xl">Recent Records</h1>
        {docsLoading && docs.length === 0 && <p>loading...</p>}
        {docsError && JSON.stringify(docsError)}
        {docs.length >= 1 && (<DataTable
          columns={columns}
          data={docs as unknown as DataRow[]}
          keyField="date"
          defaultSortFieldId="date"
          theme={DATA_TABLE_THEME}
          pagination
          onRowClicked={(row:DataRow)=>{selectRowHandler(row._id)}}
        />)}
          {children}
        </div>
      </div>
    )
  }