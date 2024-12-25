import React, { JSX } from 'react';


interface ReadyLightProps {
    enabled?: boolean;
    handleAction?: () => void;
  }
  
  export default function ReadyLight(props:ReadyLightProps):JSX.Element {
    const { enabled = false, handleAction } = props;
  
    return (
      <div title={`RFID SCAN Enabled: ${enabled ? 'Yes' : 'No'}`} className={`cursor-pointer w-[30px] h-[30px] ring-2 ring-neutral-800 ${enabled ? 'bg-green-300' : 'bg-red-950'} rounded-full m-1 p-2`}
        onClick={() => handleAction && handleAction()}
      />
    )
  }