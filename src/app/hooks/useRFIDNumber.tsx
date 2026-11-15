import { useEffect, useMemo, useState } from "react";
import {
  createRfidKeystrokeParser,
  DEFAULT_RFID_PARSER_CONFIG,
  RfidParserConfig,
} from "../../utils/rfidKeystrokeParser";

// Listens for USB RFID reader input on the window and returns the
// most recent tag id. The id is cleared when the next scan begins so that
// scanning the same tag twice in a row is reported both times.
export function useRFIDNumber(enabled: boolean, config: RfidParserConfig = DEFAULT_RFID_PARSER_CONFIG) {
    const [ rfidCode, setRfidCode ] = useState('');
    const { wait, cpsMin, cpsMax, idLength } = config;

    // The parser keeps the partial buffer outside React state, so keystrokes
    // do not force a re-render of the page between characters.
    const parser = useMemo(
        () => createRfidKeystrokeParser({ wait, cpsMin, cpsMax, idLength }),
        [wait, cpsMin, cpsMax, idLength],
    );

    useEffect(() => {
        if (!enabled) {
            parser.reset();
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            // event.timeStamp is when the key was pressed, not when this handler ran.
            const timestamp = event.timeStamp || performance.now();
            const result = parser.feed(event.key, timestamp);
            if (result.kind === 'started') {
                setRfidCode('');
            } else if (result.kind === 'scanned') {
                setRfidCode(result.code);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [enabled, parser]);

    return rfidCode;
}
