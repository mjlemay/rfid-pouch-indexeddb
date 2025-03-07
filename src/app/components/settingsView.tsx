import React, { JSX } from 'react';
import FormViewer from './formViewer';
import { formField, pouchDoc } from "../../utils/types";
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';

interface SettingsViewProps {
  children?: React.ReactNode;
  settingsDoc?: pouchDoc |  null;
  loading?: boolean;
  actionHandler?: (arg0: string) => void;
  inputFocusHandler?:(arg0?:boolean) => void;
}

const RFIDsettings:formField[] = [
  {name: "DEVICE_TYPE", inputType: "select", fieldType: "select", tailwind:"text-center",
    caption: "Select the type of RFID reader you are using. If you are unsure, select 'RFID'",
    options: [
      {name: "RFID", value: "rfid"},
      {name: "NFC-PCSP", value: "pcsp"},
    ]
  },
  {name: "RECORD_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of records to keep. Reduce  this if app becomes less performant",
  },
  {name: "LOG_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of logs to keep. Reduce this if app becomes less performant"},
  {
    name: "RFID SETTINGS", inputType: "none", fieldType: "header", tailwind:"text-center",
    caption: "These Settings Only Apply when DEVICE_TYPE is set to RFID."
  },
  {name: "WAIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Delay to clear up RFID read data in miliseconds"},
  {name: "CPS_MIN", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Slowest speed the card reads inputs a character per millisecond"
  },
  {name: "CPS_MAX", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Fastest speed the card reads inputs a character per millisecond"
  },
  {name: "ID_LENGTH", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Number of characters the reader renders the serial number as, possibly 8 or 10"
  },
  {
    name: "NFC-PCSP SETTINGS", inputType: "none", fieldType: "header", tailwind:"text-center",
    caption: "These Settings Only Aply for when DEVICE_TYPE is set to NFC-PCSP"
  },
]

  
export default function SettingsView(props:SettingsViewProps):JSX.Element {
  const { children, settingsDoc, loading, inputFocusHandler = ()=>{} } = props;
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
            fields={RFIDsettings}
            formDoc={settingsDoc}
            inputFocusHandler={inputFocusHandler}
            formActionHandler={handleRecordUpdate}
          />
        )}
        {children}
      </div>
    </div>
  )
}