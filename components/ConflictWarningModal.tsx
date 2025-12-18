
import React from 'react';
import { AlertTriangle, X, Check, Edit3 } from 'lucide-react';

interface ConflictWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflicts: string[];
  taskTitle: string;
}

const ConflictWarningModal: React.FC<ConflictWarningModalProps> = ({ isOpen, onClose, onConfirm, conflicts, taskTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in fade-in duration-200 border border-amber-200 dark:border-amber-900/30">
        
        <div className="bg-amber-500 text-white px-6 py-5 flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Phát hiện xung đột!</h2>
            <p className="text-xs opacity-90">AI nhận thấy một vài vấn đề với lịch trình</p>
          </div>
          <button onClick={onClose} className="ml-auto hover:bg-black/10 p-1 rounded-full transition"><X size={20}/></button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Công việc <span className="font-bold text-gray-800 dark:text-gray-100">"{taskTitle}"</span> có thể gây ảnh hưởng đến lịch trình hiện tại:
          </p>
          
          <div className="space-y-2 mb-6">
            {conflicts.map((msg, i) => (
              <div key={i} className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{msg}</span>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <Edit3 size={18} /> Để tôi sửa lại
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition shadow-lg shadow-amber-600/20"
            >
              <Check size={18} /> Vẫn lưu công việc
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 text-center">
           <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Powered by SmartCal AI</p>
        </div>
      </div>
    </div>
  );
};

export default ConflictWarningModal;
