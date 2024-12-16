import React, { JSX, useEffect } from 'react';
import { useDoc } from 'use-pouchdb';
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';
import FormViewer from './formViewer';


interface IdsViewProps {
    children?: React.ReactNode;
    actionHandler?: (arg0: string) => void;
    selectedId: string;
  }
  
  export default function IdsView(props:IdsViewProps):JSX.Element {
    const { children, selectedId = '' } = props;
    const addUpdateRecordData = useAddUpdateRecordData();

    const hasSelectedId = selectedId !== '';
    const { doc, loading, state, error } = useDoc(selectedId);

    const handleRecordUpdate = (recordId:string, payload:object) => {
      addUpdateRecordData(recordId, payload);
    }

    useEffect(()=>{
      if (error) {
        const errorString = JSON.stringify(error);
        console.log('err', state, error);
        if (errorString.includes('404')) {
          // create a new record if one does not exist
          addUpdateRecordData(selectedId, {});
        }
      }
    },[addUpdateRecordData, error, selectedId, state]);

    useEffect(()=>{
    },[])
  
    return (
      <div className='flex flex-col h-full w-full'
      >
        <div className='bg-neutral-800 grow rounded-lg p-4 m-10'>
          {!loading && doc && (
            <>
            <h1>Details for {doc._id}</h1>
              <FormViewer formSchema={doc} docId={doc._id} formActionHandler={handleRecordUpdate} />
            </>
          )}
          {!hasSelectedId && (
            <div className={`flex flex-1 items-center justify-center`}>
              <p>No ID selected.</p>
            </div>
          )}
        </div>
        <div className='grow'>
          {children}
        </div>
      </div>
    )
  }