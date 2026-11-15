import { useRef } from 'react';

// Returns the previous value while the new one is equal by the given test,
// so consumers keyed on identity do not react to re-emissions of unchanged data.
export function useStableValue<T>(value: T, isEqual: (previous: T, next: T) => boolean): T {
  const previous = useRef<T>(value);
  if (!isEqual(previous.current, value)) {
    previous.current = value;
  }
  return previous.current;
}
