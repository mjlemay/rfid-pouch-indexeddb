import React, { JSX, useEffect } from 'react';
import FormViewer from './formViewer';
import { formField } from "../../utils/types";
import { useDoc } from 'use-pouchdb';
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';

import {
  RECORD_LIMIT,
  LOG_LIMIT,
  WAIT,
  CPS_MIN,
  CPS_MAX,
  ID_LENGTH
} from "../../utils/consts";

interface SettingsViewProps {
  children?: React.ReactNode;
  actionHandler?: (arg0: string) => void;
}

const settings:formField[] = [
  {name: "RECORD_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of records to keep. Reduce  this if app becomes less performant"},
  {name: "LOG_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of logs to keep. Reduce this if app becomes less performant"},
  {name: "WAIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Delay to clear up RFID read data in miliseconds"},
  {name: "CPS_MIN", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Slowest speed the card reads inputs a character per milisecond"
  },
  {name: "CPS_MAX", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Fastest speed the card reads inputs a character per milisecond"
  },
  {name: "ID_LENGTH", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Number of characters the reader renders the serial number as, possibly 8 or 10"
  },
]

  
export default function SettingsView(props:SettingsViewProps):JSX.Element {
  const { children } = props;
  const addUpdateRecordData = useAddUpdateRecordData();
  const { doc, loading, state, error } = useDoc('app_settings');

  const handleRecordUpdate = (payload:{ [key: string]: string }, callback: (arg0: boolean) => void) => {
    addUpdateRecordData(payload);
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
        const defaultSettings = {
          _id: 'app_settings',
          RECORD_LIMIT: `${RECORD_LIMIT}`,
          LOG_LIMIT: `${LOG_LIMIT}`,
          WAIT: `${WAIT}`,
          CPS_MIN: `${CPS_MIN}`,
          CPS_MAX: `${CPS_MAX}`,
          ID_LENGTH: `${ID_LENGTH}`
        };
        addUpdateRecordData(defaultSettings);
      }
    }
  },[addUpdateRecordData, error, state]);

  useEffect(()=>{
    console.log(doc)
  },[doc]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        <h1 className="font-medium text-4xl">Settings</h1>
        {!loading && doc && (
          <FormViewer
            fields={settings}
            formDoc={doc}
            formActionHandler={handleRecordUpdate}
          />
        )}
        {children}
      </div>
    </div>
  )
}