import React, { JSX } from 'react';


interface IconButtonProps {
    children?: React.ReactNode;
    selected?: boolean;
    handleAction?: () => void;
  }
  
  export default function IconButton(props:IconButtonProps):JSX.Element {
    const { children, selected = false,  handleAction } = props;
  
    return (
      <div className={`cursor-pointer min-w-[40px] min-h-[40px] hover:bg-raised ${selected ? 'bg-control text-control-text' : ''} rounded-lg m-1 p-2 flex justify-center items-center`}
        onClick={() => handleAction && handleAction()}
      >
        {children}
      </div>
    )
  }