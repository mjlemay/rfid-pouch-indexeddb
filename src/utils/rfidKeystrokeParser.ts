import { CPS_MAX, CPS_MIN, ID_LENGTH, WAIT } from './consts';

export type RfidParserConfig = {
  // A gap of this many milliseconds or more marks the start of a new scan.
  wait: number;
  // Characters arriving closer together than this are not treated as reader input.
  cpsMin: number;
  // Characters arriving further apart than this are not treated as reader input.
  cpsMax: number;
  // Number of characters in a complete tag id.
  idLength: number;
};

export type RfidParserEvent =
  | { kind: 'none' }
  | { kind: 'started' }
  | { kind: 'scanned'; code: string };

export type RfidKeystrokeParser = {
  feed: (key: string, timestamp: number) => RfidParserEvent;
  reset: () => void;
};

export const DEFAULT_RFID_PARSER_CONFIG: RfidParserConfig = {
  wait: WAIT,
  cpsMin: CPS_MIN,
  cpsMax: CPS_MAX,
  idLength: ID_LENGTH,
};

const TERMINATOR_KEYS = new Set(['Enter', 'Tab']);
const HEXADECIMAL = /^[a-fA-F0-9]+$/;

// Turns the keystroke stream from a USB RFID reader into tag ids.
// Timestamps should come from the keyboard event itself so that time the page
// spends rendering between keystrokes does not count against the reader.
export function createRfidKeystrokeParser(config: RfidParserConfig): RfidKeystrokeParser {
  let buffer = '';
  let lastTimestamp: number | null = null;

  const reset = () => {
    buffer = '';
    lastTimestamp = null;
  };

  const feed = (key: string, timestamp: number): RfidParserEvent => {
    const isCharacter = key.length === 1;
    const isTerminator = TERMINATOR_KEYS.has(key);
    if (!isCharacter && !isTerminator) {
      // Modifier and navigation keys never carry tag data and must not disturb timing.
      return { kind: 'none' };
    }

    const gap = lastTimestamp === null ? Infinity : timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (isTerminator) {
      // A complete id has already been emitted when its last character arrived,
      // so anything still buffered at the terminator is an incomplete read.
      buffer = '';
      return { kind: 'none' };
    }

    let started = false;
    if (gap >= config.wait) {
      buffer = '';
      started = true;
    } else if (gap > config.cpsMax || gap < config.cpsMin) {
      // Human typing speed, or a burst that was interrupted. Drop it.
      buffer = '';
      return { kind: 'none' };
    }

    buffer += key;
    if (buffer.length === config.idLength) {
      const code = buffer;
      buffer = '';
      return HEXADECIMAL.test(code) ? { kind: 'scanned', code } : { kind: 'none' };
    }

    return started ? { kind: 'started' } : { kind: 'none' };
  };

  return { feed, reset };
}

// Builds a parser config from the app_settings document, which stores every
// value as a string. Missing or non-numeric values fall back to the defaults.
export function parserConfigFromSettings(
  settings: Record<string, unknown> | null | undefined,
  defaults: RfidParserConfig,
): RfidParserConfig {
  const readNumber = (key: string, fallback: number): number => {
    const value = settings?.[key];
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    wait: readNumber('WAIT', defaults.wait),
    cpsMin: readNumber('CPS_MIN', defaults.cpsMin),
    cpsMax: readNumber('CPS_MAX', defaults.cpsMax),
    idLength: readNumber('ID_LENGTH', defaults.idLength),
  };
}
