import React, { JSX } from 'react';
import FormViewer from './formViewer';
import { formField, pouchDoc } from "../../utils/types";
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';

interface SettingsViewProps {
  children?: React.ReactNode;
  settingsDoc?: pouchDoc |  null;
  loading?: boolean;
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
  const { children, settingsDoc,loading } = props;
  const addUpdateRecordData = useAddUpdateRecordData();
  const handleRecordUpdate = (payload:{ [key: string]: string }, callback: (arg0: boolean) => void) => {
    addUpdateRecordData(payload, 'setting');
    setTimeout(()=>{
      callback(false);
    }, 200);
  }


  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        <h1 className="font-medium text-4xl">Settings</h1>
        {!loading && settingsDoc && (
          <FormViewer
            fields={settings}
            formDoc={settingsDoc}
            formActionHandler={handleRecordUpdate}
          />
        )}
        {children}
      </div>
    </div>
  )
}