import React, { JSX } from 'react';


interface ReadyLightProps {
    enabled?: boolean;
    handleAction?: () => void;
  }
  
  export default function ReadyLight(props:ReadyLightProps):JSX.Element {
    const { enabled = false, handleAction } = props;
  
    return (
      <div title={`RFID SCAN Enabled: ${enabled ? 'Yes' : 'No'}`} className={`cursor-pointer w-[30px] h-[30px] ring-2 ring-sidebar ${enabled ? 'bg-accent' : 'bg-muted'} rounded-full m-1 p-2`}
        onClick={() => handleAction && handleAction()}
      />
    )
  }