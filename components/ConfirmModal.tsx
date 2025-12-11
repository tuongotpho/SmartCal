import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    // Sử dụng z-[60] để đảm bảo luôn nằm trên SettingsModal (z-50)
    // Thay bg-black bằng bg-orange-950 (Nâu sẫm/Hỏa thổ) để tránh màu đen (Thủy) khắc Hỏa
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-orange-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-orange-100">
        <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle size={20} /> {title}
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="bg-orange-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium transition shadow-sm"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition shadow-md text-sm font-medium"
          >
            <Trash2 size={16} /> Xóa ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;