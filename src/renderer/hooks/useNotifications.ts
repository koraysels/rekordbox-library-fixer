import { useState, useCallback } from 'react';
import type { Notification, NotificationType } from '../types';

export const useNotifications = () => {
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    clearNotification
  };
};