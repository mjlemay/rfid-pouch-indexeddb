import React, { JSX, useMemo } from 'react';
import FormViewer from './formViewer';
import { formField, pouchDoc } from "../../utils/types";
import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';
import { DEFAULT_THEME, DEFAULT_TITLE, THEME_OPTIONS } from '../../utils/themes';

interface SettingsViewProps {
  children?: React.ReactNode;
  settingsDoc?: pouchDoc |  null;
  loading?: boolean;
  actionHandler?: (arg0: string) => void;
  inputFocusHandler?:(arg0?:boolean) => void;
}

const settingsFields:formField[] = [
  {
    name: "APPEARANCE", inputType: "none", fieldType: "header", tailwind:"text-center",
    caption: "Name this page and choose its colors.",
  },
  {
    name: "TITLE", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Shown in the browser tab and at the top of every view",
  },
  {
    name: "THEME", inputType: "select", fieldType: "select", tailwind:"text-center",
    caption: "Color theme for the whole page",
    options: THEME_OPTIONS,
  },
  {
    name: "GENERAL", inputType: "none", fieldType: "header", tailwind:"text-center",
    caption: "Storage limits.",
  },
  {
    name: "RECORD_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of records to keep. Reduce this if app becomes less performant",
  },
  {
    name: "LOG_LIMIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Max number of logs to keep. Reduce this if app becomes less performant"
  },
  {
    name: "RFID SETTINGS", inputType: "none", fieldType: "header", tailwind:"text-center",
    caption: "Timing and format of the USB RFID reader.",
  },
  {
    name: "WAIT", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Pause in milliseconds that marks the start of a new scan",
  },
  {name: "CPS_MIN", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Shortest gap in milliseconds between characters that counts as reader input",
  },
  {name: "CPS_MAX", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Longest gap in milliseconds between characters that counts as reader input",
  },
  {name: "ID_LENGTH", inputType: "text", fieldType: "input", tailwind:"text-center",
    caption: "Number of characters the reader renders the serial number as, possibly 8 or 10",
  },
]

export default function SettingsView(props:SettingsViewProps):JSX.Element {
  const { children, settingsDoc, loading, inputFocusHandler = ()=>{} } = props;
  const addUpdateRecordData = useAddUpdateRecordData();
  // Settings saved before themes existed have no TITLE or THEME, so the form
  // shows the defaults for them instead of empty values.
  const formDoc = useMemo(
    () => settingsDoc ? { TITLE: DEFAULT_TITLE, THEME: DEFAULT_THEME, ...settingsDoc } : undefined,
    [settingsDoc],
  );
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
            fields={settingsFields}
            formDoc={formDoc}
            inputFocusHandler={inputFocusHandler}
            formActionHandler={handleRecordUpdate}
          />
        )}
        {children}
      </div>
    </div>
  )
}