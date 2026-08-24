import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import type { AppNotification } from '../../hooks/useNotifications';

const STYLES = {
  success: { Icon: CheckCircle2, className: 'bg-te-green-100 border-te-green-200 text-te-green-600' },
  error: { Icon: XCircle, className: 'bg-te-red-100 border-te-red-200 text-te-red-500' },
  warning: { Icon: AlertTriangle, className: 'bg-te-amber-100 border-te-amber-200 text-te-amber-600' },
  info: { Icon: Info, className: 'bg-te-grey-200 border-te-grey-300 text-te-grey-700' },
} as const;

interface NotificationToastProps {
  notifications: AppNotification[];
  onDismiss: (id: number) => void;
}

/**
 * A stack, not a single slot. Messages used to overwrite one another, so an
 * error could vanish behind a success that arrived a moment later.
 */
export const NotificationToast: React.FC<NotificationToastProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) { return null; }

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col gap-2 w-[min(30rem,calc(100%-1.5rem))] pointer-events-none">
      {notifications.map(({ id, type, message, repeats }) => {
        const { Icon, className } = STYLES[type] ?? STYLES.info;
        return (
          <div
            key={id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-te border-2 px-3 py-2.5 shadow-lg ${className}`}
          >
            <Icon size={15} className="mt-0.5 flex-shrink-0" />
            {/* Messages carry paths and counts over several lines, so they wrap
                rather than being clipped to one. */}
            <p className="flex-1 min-w-0 text-xs font-te-mono normal-case leading-relaxed whitespace-pre-line break-words">
              {message}
              {repeats > 1 && (
                <span className="ml-1.5 opacity-60">×{repeats}</span>
              )}
            </p>
            <button
              onClick={() => onDismiss(id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
