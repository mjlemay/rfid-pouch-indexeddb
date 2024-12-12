import React, { JSX } from 'react';

interface SettingsViewProps {
    children?: React.ReactNode;
    actionHandler?: (arg0: string) => void;
  }
  
  export default function SettingsView(props:SettingsViewProps):JSX.Element {
    const { children } = props;
  
    return (
      <div className='cursor-pointer min-w-[40px] min-h-[40px] hover:bg-neutral-800 rounded-lg m-1 p-2 flex justify-center items-center '
      >
        <h1>Settings</h1>
        {children}
      </div>
    )
  }