import { Button } from './Button';
import { XMarkIcon } from './icons';

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <div
      className={`absolute right-0 top-full mt-2 w-64 z-20 transition-all duration-200 ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
      }`}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4">
        <div className="flex items-start gap-3 mb-4">
          <p className="text-sm text-gray-700 flex-1">{message}</p>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
