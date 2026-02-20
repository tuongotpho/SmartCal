import React, { useEffect, useRef } from 'react';
import { X, Bell, Clock, Calendar, Tag, Volume2, VolumeX } from 'lucide-react';
import { Task, Tag as TagType } from '../types';
import { soundService } from '../services/soundService';

interface ReminderModalProps {
  isOpen: boolean;
  task: Task | null;
  tags: TagType[];
  onClose: () => void;
  onSnooze?: (minutes: number) => void;
  onMarkComplete?: () => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  task,
  tags,
  onClose,
  onSnooze,
  onMarkComplete
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(soundService.isEnabledState());

  // Phát âm thanh khi mở modal
  useEffect(() => {
    if (isOpen && task) {
      // Phát âm thanh 3 lần
      soundService.playRepeat(3, 600);
    }
  }, [isOpen, task]);

  // Đóng modal bằng Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside để đóng
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const toggleSound = () => {
    const newState = soundService.toggle();
    setSoundEnabled(newState);
  };

  const getTagColor = (tagName: string): string => {
    const tag = tags.find(t => t.name === tagName);
    if (tag && tag.color) {
      return tag.color;
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const getSnoozeOptions = () => [
    { label: '5 phút', value: 5 },
    { label: '10 phút', value: 10 },
    { label: '15 phút', value: 15 },
    { label: '30 phút', value: 30 },
  ];

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-primary-200 dark:border-gray-700"
      >
        {/* Header với gradient */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-4 relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Bell size={24} className="animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nhắc nhở công việc</h2>
              <p className="text-sm text-white/80">Sắp đến hạn thực hiện</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Task Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {task.title}
          </h3>

          {/* Task Info */}
          <div className="space-y-3 mb-6">
            {/* Date & Time */}
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
              <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <Calendar size={18} className="text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Thời gian</p>
                <p className="font-medium">{task.date} lúc {formatTime(task.time)}</p>
              </div>
            </div>

            {/* Duration */}
            {task.duration && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Thời lượng</p>
                  <p className="font-medium">{task.duration}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <Tag size={18} className="text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phân loại</p>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag, idx) => (
                      <span 
                        key={idx} 
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Mark Complete Button */}
            {onMarkComplete && (
              <button
                onClick={onMarkComplete}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                ✓ Đánh dấu hoàn thành
              </button>
            )}

            {/* Snooze Options */}
            {onSnooze && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-full mb-1">Nhắc lại sau:</span>
                {getSnoozeOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => onSnooze(option.value)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold transition"
            >
              Tắt thông báo
            </button>
          </div>
        </div>

        {/* Footer với toggle âm thanh */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Thông báo sẽ tự động tắt sau 30 giây</span>
          <button
            onClick={toggleSound}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 transition"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? 'Âm thanh bật' : 'Âm thanh tắt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;
