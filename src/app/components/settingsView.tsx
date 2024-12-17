import React, { JSX } from 'react';
import FormViewer from './formViewer';
import { formField } from "../../utils/types";

interface SettingsViewProps {
  children?: React.ReactNode;
  settingsDoc: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
  actionHandler?: (arg0: unknown) => void;
}

const settings:formField[] = [

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
          formActionHandler={handleRecordUpdate}
        />
        {children}
      </div>
    </div>
  )
}