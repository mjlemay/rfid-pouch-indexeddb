import { useState, useCallback, useEffect } from "react";

const WAIT = 300;
const CPS_MIN = 5;
const CPS_MAX = 28;
const ID_LENGTH = 8;

export function useRFIDNumber() {
    const [ codeString, setCodeString ] = useState('');
    const [ rfidCode, setRfidCode ] = useState('');
    const [ lastDate, setLastDate ] = useState(new Date());

    const handleUserKeyPress = useCallback((event:KeyboardEvent) => {
    const { key, keyCode } = event;
    const nextDate = new Date();
    let cps = nextDate.getTime() - lastDate.getTime();
    if (cps >= WAIT) {
        setRfidCode('');
        cps = CPS_MIN; //allows for first character to pass through
    }

    if (
        key !== 'enter'
        && keyCode !== 13
        && cps <= CPS_MAX
        && cps >= CPS_MIN
    ) {
        const newCode = codeString + key;
        setCodeString(newCode);
        setRfidCode('');
    }
    if (
        cps > CPS_MAX
        || cps < CPS_MIN
    ) {
        setCodeString(''); // resets reader if cps is inconsistent
    }
    // clear values if rfid value or has reach id length
    if (
        (
            key !== 'enter'
            && keyCode !== 13
            && codeString.length === ID_LENGTH - 1
        )
    ) {
        setRfidCode(codeString);
        setCodeString('');
    }
    setLastDate(nextDate);
    }, [codeString, lastDate]);

    useEffect(() => {
        window.addEventListener("keydown", handleUserKeyPress);
        return () => {
            window.removeEventListener("keydown", handleUserKeyPress);
        };
    }, [handleUserKeyPress]);

    return rfidCode;
}