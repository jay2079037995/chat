import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
}

export function useLongPress({ onLongPress, delay = 500 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    isLongPress: isLongPressRef,
  };
}
