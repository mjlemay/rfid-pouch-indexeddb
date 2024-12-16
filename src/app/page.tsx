'use client';

import { useState, useEffect } from 'react';
import SideMenuBar from './components/sideMenuBar';
import LogsView from './components/logsView';
import IdsView from './components/idsView';
import InputsView from './components/inputsView';
import SettingsView from './components/settingsView';
import { useAddScanRecord } from './hooks/useAddScanRecord';
import { useRFIDNumber } from './hooks/useRFIDNumber';

export default function Home() {
  const addScanRecord = useAddScanRecord();
  const rifdNumber = useRFIDNumber();
  const [ view, setView ] = useState('log');
  const [selectedId, setSelectedId ] = useState( '');
  const [ logging, setLogging ] = useState(false);
  

  const handleAction = (action:string) => {
    if (action) {
      setView(action);
    }
  }

  useEffect(() => {
    if (rifdNumber !== '' && !logging) {
      setLogging(true);
      setSelectedId(rifdNumber);
      addScanRecord(rifdNumber);
      setView('ids');
    }
    if (logging && rifdNumber === '') {
      setLogging(false);
    }
  },[addScanRecord, logging, rifdNumber]);

  return (
    <div
      className={`flex w-screen bg-neutral-900 text-white select-none`}
      data-theme={"darkTheme"}
    >
      <SideMenuBar selected={view} screenActionHandler={handleAction}  />
      <div className={`flex flex-1 items-center justify-center`}>
        {view == 'ids' && <IdsView actionHandler={handleAction} selectedId={selectedId} />}
        {view == 'logs' && <LogsView actionHandler={handleAction} />}
        {view == 'inputs' && <InputsView actionHandler={handleAction} />}
        {view == 'settings' && <SettingsView actionHandler={handleAction} />}
      </div>
    </div>
  );
}
