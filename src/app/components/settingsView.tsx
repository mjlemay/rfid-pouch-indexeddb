import React, { JSX } from 'react';
import FormViewer from './formViewer';
import { formField } from "../../utils/types";

interface SettingsViewProps {
  children?: React.ReactNode;
  settingsDoc?: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
  actionHandler?: (arg0: string) => void;
}

const settings:formField[] = [
  {name: "LOG_LIMIT", inputType: "text", fieldType: "input",
    caption: "Max number of logs to keep. Reduce this if app becomes less performant"},
  {name: "WAIT", inputType: "text", fieldType: "input",
    caption: "Delay to clear up RFID read data in miliseconds"},
  {name: "CPS_MIN", inputType: "text", fieldType: "input",
    caption: "Slowest speed the card reads inputs a character per milisecond"
  },
  {name: "CPS_MAX", inputType: "text", fieldType: "input",
    caption: "Fastest speed the card reads inputs a character per milisecond"
  },
  {name: "ID_LENGTH", inputType: "text", fieldType: "input",
    caption: "Number of characters the reader renders the serial number as, possibly 8 or 10"
  },
]

  
export default function SettingsView(props:SettingsViewProps):JSX.Element {
  const { children, settingsDoc } = props;

  const handleRecordUpdate = () => {};

  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        <h1 className="font-medium text-4xl">Settings</h1>
        <FormViewer
          fields={settings}
          formDoc={settingsDoc}
          formActionHandler={() => handleRecordUpdate}
        />
        {children}
      </div>
    </div>
  )
}