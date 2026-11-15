'use client';

import { useState, useEffect, useMemo } from 'react';
import SideMenuBar from './components/sideMenuBar';
import LogsView from './components/logsView';
import IdsView from './components/idsView';
import InputsView from './components/inputsView';
import SettingsView from './components/settingsView';
import TopBar from './components/topBar';
import { useAddScanRecord } from './hooks/useAddScanRecord';
import { useRFIDNumber } from './hooks/useRFIDNumber';
import { useApplyAppearance } from './hooks/useApplyAppearance';
import { useAddUpdateRecordData } from './hooks/useUpdateRecordData';
import { useDoc } from 'use-pouchdb';
import {
  RECORD_LIMIT,
  LOG_LIMIT,
  WAIT,
  CPS_MIN,
  CPS_MAX,
  ID_LENGTH,
} from "../utils/consts";
import { pouchDocItem } from "../utils/types";
import { DEFAULT_RFID_PARSER_CONFIG, parserConfigFromSettings } from "../utils/rfidKeystrokeParser";
import { appearanceFromSettings, DEFAULT_APPEARANCE } from "../utils/themes";


export default function Home() {
  const [ view, setView ] = useState('log');
  const [selectedId, setSelectedId ] = useState( '');
  const [ logging, setLogging ] = useState(false);
  const [ numReady, setnumReady ] = useState(true);
  const addUpdateRecordData = useAddUpdateRecordData();
  const { 
    doc: settingsDoc,
    loading: loadingSettings,
    state: settingsState,
    error:settingsError 
} = useDoc('app_settings');
const addScanRecord = useAddScanRecord();
const pouchSettingsDoc = settingsDoc as pouchDocItem;
const rfidParserConfig = useMemo(
  () => parserConfigFromSettings(pouchSettingsDoc, DEFAULT_RFID_PARSER_CONFIG),
  [pouchSettingsDoc],
);
const rifdNumber = useRFIDNumber(numReady, rfidParserConfig);
const appearance = useMemo(
  () => appearanceFromSettings(pouchSettingsDoc, DEFAULT_APPEARANCE),
  [pouchSettingsDoc],
);
useApplyAppearance(appearance);
  

  const handleAction = (action:string) => {
    if (action) {
      setView(action);
    }
  }

  const handleFocusChange = (value?:boolean) => {
    const newValue = value || false;
    setnumReady(newValue);
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
          TITLE: DEFAULT_APPEARANCE.title,
          THEME: DEFAULT_APPEARANCE.theme,
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
      className={`flex w-full min-h-screen bg-background text-text select-none`}
    >
      <SideMenuBar selected={view} scanReady={numReady} screenActionHandler={handleAction}  />
      <div className="flex flex-1 flex-col min-w-0">
      <TopBar title={appearance.title} />
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
    </div>
  );
}
