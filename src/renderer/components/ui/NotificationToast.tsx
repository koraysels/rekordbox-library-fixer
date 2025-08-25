import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { Notification } from '../../types';

interface NotificationToastProps {
  notification: Notification;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification }) => {
  return (
    <div className={`fixed top-28 right-6 z-40 p-4 rounded-lg shadow-xl flex items-center space-x-3 ${
      notification.type === 'success' ? 'bg-green-600' :
      notification.type === 'error' ? 'bg-red-600' :
      'bg-blue-600'
    } text-white`}>
      {notification.type === 'success' ? (
        <CheckCircle className="w-5 h-5" />
      ) : (
        <AlertCircle className="w-5 h-5" />
      )}
      <span>{notification.message}</span>
    </div>
  );
};