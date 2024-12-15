import { useState, useCallback, useEffect } from "react";

export function useRFIDNumber() {
    const [ codeString, setCodeString ] = useState('');
    const [ rfidCode, setRfidCode ] = useState('');

    const handleUserKeyPress = useCallback((event:KeyboardEvent) => {
    const { key, keyCode } = event;
    if (key !== 'enter' && keyCode !== 13) {
        const newCode = codeString + key;
        setCodeString(newCode);
        setRfidCode('');
    }
    if (key === 'enter' || keyCode === 13) {
        setRfidCode(codeString);
        setCodeString('');
    }
    }, [codeString]);

    useEffect(() => {
        window.addEventListener("keydown", handleUserKeyPress);
        return () => {
            window.removeEventListener("keydown", handleUserKeyPress);
        };
    }, [handleUserKeyPress]);

    return rfidCode;
}