import { describe, expect, test } from 'vitest';
import {
  createRfidKeystrokeParser,
  parserConfigFromSettings,
  RfidParserConfig,
  RfidParserEvent,
} from './rfidKeystrokeParser';

const config: RfidParserConfig = { wait: 300, cpsMin: 0, cpsMax: 30, idLength: 8 };

// Feeds a burst of keys spaced gapMs apart, starting at startAt, and returns every event.
function feedBurst(
  parser: ReturnType<typeof createRfidKeystrokeParser>,
  keys: string[],
  startAt: number,
  gapMs = 10,
): RfidParserEvent[] {
  return keys.map((key, index) => parser.feed(key, startAt + index * gapMs));
}

function scannedCodes(events: RfidParserEvent[]): string[] {
  return events.flatMap((event) => (event.kind === 'scanned' ? [event.code] : []));
}

describe('createRfidKeystrokeParser', () => {
  test('emits the code when idLength hex characters are followed by Enter', () => {
    const parser = createRfidKeystrokeParser(config);
    const events = feedBurst(parser, [...'0a1b2c3d', 'Enter'], 1000);
    expect(scannedCodes(events)).toEqual(['0a1b2c3d']);
  });

  test('emits the code as soon as idLength characters arrive, without a terminator', () => {
    const parser = createRfidKeystrokeParser(config);
    const events = feedBurst(parser, [...'12345678'], 1000);
    expect(scannedCodes(events)).toEqual(['12345678']);
  });

  test('a pause of wait or longer discards a partial read instead of prepending it to the next scan', () => {
    const parser = createRfidKeystrokeParser(config);
    feedBurst(parser, [...'abc'], 1000);
    const events = feedBurst(parser, [...'12345678', 'Enter'], 5000);
    expect(scannedCodes(events)).toEqual(['12345678']);
  });

  test('reports started on the first key after a pause', () => {
    const parser = createRfidKeystrokeParser(config);
    const [first, second] = feedBurst(parser, [...'12'], 1000);
    expect(first).toEqual({ kind: 'started' });
    expect(second).toEqual({ kind: 'none' });
  });

  test('ignores modifier keys such as Shift without disturbing the read', () => {
    const parser = createRfidKeystrokeParser(config);
    const keys = ['Shift', 'A', 'Shift', 'B', '1', '2', '3', '4', '5', '6', 'Enter'];
    const events = feedBurst(parser, keys, 1000, 2);
    expect(scannedCodes(events)).toEqual(['AB123456']);
  });

  test('discards a burst when a gap between characters exceeds cpsMax but is shorter than wait', () => {
    const parser = createRfidKeystrokeParser(config);
    feedBurst(parser, [...'1234'], 1000);
    const events = feedBurst(parser, [...'5678', 'Enter'], 1030 + 100);
    expect(scannedCodes(events)).toEqual([]);
  });

  test('discards characters arriving faster than cpsMin when cpsMin is set', () => {
    const parser = createRfidKeystrokeParser({ ...config, cpsMin: 3 });
    const events = feedBurst(parser, [...'12345678', 'Enter'], 1000, 1);
    expect(scannedCodes(events)).toEqual([]);
  });

  test('emits nothing for a burst that is not hexadecimal', () => {
    const parser = createRfidKeystrokeParser(config);
    const events = feedBurst(parser, [...'zzzzzzzz', 'Enter'], 1000);
    expect(scannedCodes(events)).toEqual([]);
  });

  test('Enter after the wrong number of characters discards the buffer', () => {
    const parser = createRfidKeystrokeParser(config);
    feedBurst(parser, [...'123', 'Enter'], 1000);
    const events = feedBurst(parser, [...'45678'], 1040);
    expect(scannedCodes(events)).toEqual([]);
  });

  test('reset clears any partial buffer', () => {
    const parser = createRfidKeystrokeParser(config);
    feedBurst(parser, [...'1234'], 1000);
    parser.reset();
    const events = feedBurst(parser, [...'5678'], 1040);
    expect(scannedCodes(events)).toEqual([]);
  });
});

describe('parserConfigFromSettings', () => {
  const defaults: RfidParserConfig = { wait: 300, cpsMin: 0, cpsMax: 30, idLength: 8 };

  test('reads numeric strings from the stored settings document', () => {
    const settings = { WAIT: '500', CPS_MIN: '2', CPS_MAX: '40', ID_LENGTH: '10' };
    expect(parserConfigFromSettings(settings, defaults)).toEqual({
      wait: 500, cpsMin: 2, cpsMax: 40, idLength: 10,
    });
  });

  test('falls back to defaults for missing or non-numeric values', () => {
    const settings = { WAIT: 'fast', CPS_MAX: '' };
    expect(parserConfigFromSettings(settings, defaults)).toEqual(defaults);
    expect(parserConfigFromSettings(undefined, defaults)).toEqual(defaults);
  });
});
