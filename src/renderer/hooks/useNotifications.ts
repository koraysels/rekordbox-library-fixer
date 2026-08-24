import { useState, useCallback, useRef, useEffect } from 'react';
import type { NotificationType } from '../types';

export interface AppNotification {
  id: number;
  type: NotificationType;
  message: string;
  /** How many times this same message arrived while it was on screen. */
  repeats: number;
}

/** How long each kind stays. Errors linger; a failure you missed is worse. */
const LIFETIME: Record<NotificationType, number> = {
  success: 4000,
  info: 5000,
  error: 12000,
  warning: 9000,
};

/** Beyond this the stack is noise; the oldest drop off. */
const MAX_VISIBLE = 4;

const keyOf = (n: { type: NotificationType; message: string }) => `${n.type}:${n.message}`;

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  /**
   * The list as it stands right now. Several notifications can be raised in one
   * tick — a loop reporting per-track results, say — and a state updater has not
   * run yet at that point, so deciding "is this already on screen?" from state
   * would see a stale list and stack copies anyway.
   */
  const current = useRef<AppNotification[]>([]);

  const commit = useCallback((next: AppNotification[]) => {
    current.current = next;
    setNotifications(next);
  }, []);

  const stopTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const dismissNotification = useCallback((id: number) => {
    stopTimer(id);
    commit(current.current.filter((n) => n.id !== id));
  }, [commit, stopTimer]);

  // Timers outlive the component otherwise, and fire against a dead setState.
  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  /**
   * Show a message. Several can be on screen at once: a single slot meant each
   * new message silently replaced the last, so a failure could be masked by a
   * success that happened to arrive after it.
   *
   * The same message arriving again does not stack a second copy — progress
   * updates and re-renders repeat themselves constantly, and four identical
   * toasts say nothing the first one didn't. The one already up restarts its
   * clock and counts the repeats instead.
   *
   * `important` also raises an operating-system notification, for results worth
   * knowing about when the window is not in front — a finished scan, a failed
   * write.
   */
  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    options: { important?: boolean } = {}
  ) => {
    const lifetime = LIFETIME[type] ?? 5000;
    const key = keyOf({ type, message });
    const existing = current.current.find((n) => keyOf(n) === key);

    if (existing) {
      commit(current.current.map((n) =>
        (n.id === existing.id ? { ...n, repeats: n.repeats + 1 } : n)));
      stopTimer(existing.id);
      timers.current.set(existing.id, setTimeout(() => dismissNotification(existing.id), lifetime));
      return;
    }

    const id = nextId.current++;
    const next = [...current.current, { id, type, message, repeats: 1 }];
    // Anything pushed off the stack releases its timer with it.
    for (const dropped of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
      stopTimer(dropped.id);
    }
    commit(next.slice(-MAX_VISIBLE));
    timers.current.set(id, setTimeout(() => dismissNotification(id), lifetime));

    if (options.important) {
      // Fire and forget: a missing system notification must never break the
      // action that produced it.
      void window.electronAPI.showSystemNotification?.({ type, message });
    }
  }, [commit, dismissNotification, stopTimer]);

  const clearNotification = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    commit([]);
  }, [commit]);

  return { notifications, showNotification, dismissNotification, clearNotification };
};
