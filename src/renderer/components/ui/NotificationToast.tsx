import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { Notification } from '../../types';

interface NotificationToastProps {
  notification: Notification;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification }) => {
  return (
    <div className={`fixed top-28 right-6 z-40 p-4 rounded-te shadow-xl flex items-center space-x-3 border-2 ${
      notification.type === 'success' ? 'bg-te-green-500 border-te-green-500' :
      notification.type === 'error' ? 'bg-te-red-500 border-te-red-500' :
      'bg-te-orange border-te-orange'
    } text-te-cream font-te-mono`}>
      {notification.type === 'success' ? (
        <CheckCircle className="w-5 h-5" />
      ) : (
        <AlertCircle className="w-5 h-5" />
      )}
      <span>{notification.message}</span>
    </div>
  );
};