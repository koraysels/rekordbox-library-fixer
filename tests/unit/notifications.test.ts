import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../../src/renderer/hooks/useNotifications';

// The shared setup defines electronAPI non-writably, so replace just the one
// method this hook reaches for.
beforeEach(() => {
  vi.useFakeTimers();
  (window as any).electronAPI.showSystemNotification = vi.fn();
});
afterEach(() => { vi.useRealTimers(); });

describe('useNotifications', () => {
  it('shows a message', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => { result.current.showNotification('info', 'hello'); });
    expect(result.current.notifications).toHaveLength(1);
  });

  it('does not stack the same message twice', () => {
    // Progress updates and re-renders repeat themselves constantly; four
    // identical toasts say nothing the first one didn't.
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification('info', 'scanning');
      result.current.showNotification('info', 'scanning');
      result.current.showNotification('info', 'scanning');
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].repeats).toBe(3);
  });

  it('keeps different messages apart', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification('info', 'one');
      result.current.showNotification('error', 'two');
    });
    expect(result.current.notifications).toHaveLength(2);
  });

  it('treats the same text of a different kind as its own message', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification('info', 'done');
      result.current.showNotification('error', 'done');
    });
    expect(result.current.notifications).toHaveLength(2);
  });

  it('restarts the clock when a message repeats', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => { result.current.showNotification('success', 'saved'); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.showNotification('success', 'saved'); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.notifications).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.notifications).toHaveLength(0);
  });

  it('shows the same message again once it has gone', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => { result.current.showNotification('success', 'saved'); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.notifications).toHaveLength(0);
    act(() => { result.current.showNotification('success', 'saved'); });
    expect(result.current.notifications).toHaveLength(1);
  });

  it('keeps at most four on screen', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      for (let i = 0; i < 7; i++) { result.current.showNotification('info', `m${i}`); }
    });
    expect(result.current.notifications).toHaveLength(4);
    expect(result.current.notifications[0].message).toBe('m3');
  });

  it('lets a message dropped off the stack be shown again', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      for (let i = 0; i < 6; i++) { result.current.showNotification('info', `m${i}`); }
      result.current.showNotification('info', 'm0');
    });
    expect(result.current.notifications.some((n) => n.message === 'm0')).toBe(true);
  });

  it('errors stay longer than successes', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification('success', 'ok');
      result.current.showNotification('error', 'broke');
    });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.notifications.map((n) => n.message)).toEqual(['broke']);
  });

  it('raises a system notification only when asked', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification('info', 'quiet');
      result.current.showNotification('success', 'loud', { important: true });
    });
    const calls = (window as any).electronAPI.showSystemNotification.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].message).toBe('loud');
  });

  it('can be dismissed by hand', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => { result.current.showNotification('info', 'bye'); });
    const id = result.current.notifications[0].id;
    act(() => { result.current.dismissNotification(id); });
    expect(result.current.notifications).toHaveLength(0);
  });
});
