'use client';

import { useState, useEffect } from 'react';
import SideMenuBar from './components/sideMenuBar';
import LogsView from './components/logsView';
import IdsView from './components/idsView';
import InputsView from './components/inputsView';
import SettingsView from './components/settingsView';
import { useAddScanRecord } from './hooks/useAddScanRecord';
import { useRFIDNumber } from './hooks/useRFIDNumber';
import { useAddUpdateRecordData } from './hooks/useUpdateRecordData';
import { useDoc } from 'use-pouchdb';
import {
  RECORD_LIMIT,
  LOG_LIMIT,
  WAIT,
  CPS_MIN,
  CPS_MAX,
  ID_LENGTH,
  DEVICE_TYPE
} from "../utils/consts";
import { pouchDocItem } from "../utils/types";


export default function Home() {
  const [ view, setView ] = useState('log');
  const [selectedId, setSelectedId ] = useState( '');
  const [ logging, setLogging ] = useState(false);
  const [ readReady, setReadReady ] = useState(true);
  const addUpdateRecordData = useAddUpdateRecordData();
  const { 
    doc: settingsDoc,
    loading: loadingSettings,
    state: settingsState,
    error:settingsError 
} = useDoc('app_settings');
const addScanRecord = useAddScanRecord();
const rifdNumber = useRFIDNumber(readReady);
const pouchSettingsDoc = settingsDoc as pouchDocItem; 
  

  const handleAction = (action:string) => {
    if (action) {
      setView(action);
    }
  }

  const handleFocusChange = (value?:boolean) => {
    const newValue = value || false;
    setReadReady(newValue);
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

  useEffect(()=>{
    if (settingsError) {
      const errorString = JSON.stringify(settingsError);
      console.log('err', settingsState, settingsError);
      if (errorString.includes('404')) {
        // create a new record if one does not exist
        const defaultSettings = {
          _id: 'app_settings',
          DEVICE_TYPE: `${DEVICE_TYPE}`,
          RECORD_LIMIT: `${RECORD_LIMIT}`,
          LOG_LIMIT: `${LOG_LIMIT}`,
          WAIT: `${WAIT}`,
          CPS_MIN: `${CPS_MIN}`,
          CPS_MAX: `${CPS_MAX}`,
          ID_LENGTH: `${ID_LENGTH}`
        };
        addUpdateRecordData(defaultSettings, 'setting');
      }
    }
  },[addUpdateRecordData, settingsError, settingsState]);

  return (
    <div
      className={`flex w-screen bg-neutral-900 text-white select-none`}
      data-theme={"darkTheme"}
    >
      <SideMenuBar selected={view} readReady={readReady} screenActionHandler={handleAction}  />
      {pouchSettingsDoc && (
        <div className={`flex flex-1 items-center justify-center`}>
        {view == 'ids' && <IdsView 
          selectRowHandler={setSelectedId}
          inputFocusHandler={handleFocusChange}
          selectedId={selectedId}
            limit={parseInt(pouchSettingsDoc.RECORD_LIMIT as string)}
          />}
          {view == 'logs' && <LogsView
            actionHandler={handleAction}
            selectRowHandler={(scanId) => { setSelectedId(scanId); setView('ids'); }}
          />}
          {view == 'inputs' && <InputsView actionHandler={handleAction} />}
          {view == 'settings' && <SettingsView 
            actionHandler={handleAction}
            inputFocusHandler={handleFocusChange}
            loading={loadingSettings}
            settingsDoc={settingsDoc} 
          />}
        </div>
      )}
    </div>
  );
}
