import { useState, useCallback, useRef } from 'react';
import type { NotificationType } from '../types';

export interface AppNotification {
  id: number;
  type: NotificationType;
  message: string;
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

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const nextId = useRef(1);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  /**
   * Show a message. Several can be on screen at once: a single slot meant each
   * new message silently replaced the last, so a failure could be masked by a
   * success that happened to arrive after it.
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
    const id = nextId.current++;
    setNotifications((current) => [...current, { id, type, message }].slice(-MAX_VISIBLE));
    setTimeout(() => dismissNotification(id), LIFETIME[type] ?? 5000);

    if (options.important) {
      // Fire and forget: a missing system notification must never break the
      // action that produced it.
      void window.electronAPI.showSystemNotification?.({ type, message });
    }
  }, [dismissNotification]);

  const clearNotification = useCallback(() => setNotifications([]), []);

  return { notifications, showNotification, dismissNotification, clearNotification };
};
