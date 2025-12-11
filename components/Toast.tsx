
import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 3000); // Tự động tắt sau 3s

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-white border-l-4 border-green-500 text-gray-800';
      case 'error':
        return 'bg-white border-l-4 border-red-500 text-gray-800';
      case 'warning':
        return 'bg-white border-l-4 border-yellow-500 text-gray-800';
      default:
        return 'bg-white border-l-4 border-blue-500 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle2 size={18} className="text-green-500" />;
      case 'error': return <AlertCircle size={18} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-yellow-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 p-4 rounded shadow-lg min-w-[300px] max-w-[400px] animate-in slide-in-from-right duration-300 ${getStyle()}`}>
      <div className="flex-shrink-0">{getIcon()}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-gray-400 hover:text-gray-600 transition">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
