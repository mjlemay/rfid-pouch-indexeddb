import React, { JSX } from 'react';
import { 
  ActivityLogIcon,
  AvatarIcon,
  // GearIcon,
  // InputIcon,
} from '@radix-ui/react-icons';
import IconButton from './iconButton';
import ReadyLight from './readyLight';

interface SideMenuBarProps {
    children?: React.ReactNode;
    selected?: string;
    readReady?: boolean;
    screenActionHandler: (arg0: string) => void;
  }
  
  export default function SideMenuBar(props:SideMenuBarProps):JSX.Element {
    const { children, screenActionHandler, readReady = false, selected} = props;
  
    return (
      <div className={`h-screen min-h-screen w-[75px] bg-black`}>
        <div className="min-w-[50px] min-h-[50px] flex justify-center items-center ">
          <ReadyLight enabled={readReady} />
        </div>
        <IconButton selected={selected === 'ids'} handleAction={()=> screenActionHandler('ids')}>
            <AvatarIcon className="min-w-[50px] min-h-[50px]" />
        </IconButton>
        <IconButton selected={selected === 'logs'} handleAction={()=> screenActionHandler('logs')}>
            <ActivityLogIcon className="min-w-[50px] min-h-[50px]" />
        </IconButton>
        {/* <IconButton selected={selected === 'inputs'} handleAction={()=> screenActionHandler('inputs')}>
            <InputIcon className="min-w-[50px] min-h-[50px]" />
        </IconButton>
        <IconButton selected={selected === 'settings'} handleAction={()=> screenActionHandler('settings')}>
            <GearIcon className="min-w-[50px] min-h-[50px]" />
        </IconButton> */}
        {children}
      </div>
    )
  }