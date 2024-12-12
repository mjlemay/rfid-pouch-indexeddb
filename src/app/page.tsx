'use client'

import { useState } from 'react';
import SideMenuBar from './components/sideMenuBar';
import LogsView from './components/logsView';
import IdsView from './components/idsView';
import InputsView from './components/inputsView';
import SettingsView from './components/settingsView';

export default function Home() {
  const [ view, setView ] = useState('log');

  const handleAction = (action:string) => {
    if (action) {
      setView(action);
    }
  }


  return (
    <div
      className={`flex w-screen bg-neutral-900 text-white select-none`}
      data-theme={"darkTheme"}
    >
      <SideMenuBar screenActionHandler={handleAction}  />
      <div className={`flex flex-1 items-center justify-center`}>
        {view == 'ids' && <IdsView actionHandler={handleAction} />}
        {view == 'logs' && <LogsView actionHandler={handleAction} />}
        {view == 'inputs' && <InputsView actionHandler={handleAction} />}
        {view == 'settings' && <SettingsView actionHandler={handleAction} />}
      </div>
    </div>
  );
}
