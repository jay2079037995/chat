import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../src/hooks/useLongPress';

describe('useLongPress hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should trigger callback after default delay (500ms)', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const mockEvent = { preventDefault: jest.fn() } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    // Not yet triggered
    expect(onLongPress).not.toHaveBeenCalled();

    // Advance past delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.isLongPress.current).toBe(true);
  });

  it('should not trigger on short press', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const mockEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    // Release before delay
    act(() => {
      jest.advanceTimersByTime(200);
      result.current.onTouchEnd();
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(result.current.isLongPress.current).toBe(false);
  });

  it('should cancel on touch move', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const mockEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    // Move finger cancels long press
    act(() => {
      jest.advanceTimersByTime(200);
      result.current.onTouchMove();
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should support custom delay', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 1000 }));

    const mockEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    // Default delay (500ms) should not trigger
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    // Custom delay (1000ms) should trigger
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('should reset isLongPress on new touch start', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const mockEvent = {} as React.TouchEvent;

    // First long press
    act(() => {
      result.current.onTouchStart(mockEvent);
      jest.advanceTimersByTime(500);
    });
    expect(result.current.isLongPress.current).toBe(true);

    // New touch start resets
    act(() => {
      result.current.onTouchStart(mockEvent);
    });
    expect(result.current.isLongPress.current).toBe(false);
  });
});
