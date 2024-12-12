import React, { JSX } from 'react';


interface IconButtonProps {
    children?: React.ReactNode;
    handleAction?: () => void;
  }
  
  export default function IconButton(props:IconButtonProps):JSX.Element {
    const { children, handleAction } = props;
  
    return (
      <div className='cursor-pointer min-w-[40px] min-h-[40px] hover:bg-neutral-800 rounded-lg m-1 p-2 flex justify-center items-center '
        onClick={() => handleAction && handleAction()}
      >
        {children}
      </div>
    )
  }