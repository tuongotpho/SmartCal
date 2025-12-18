
import React, { useState, useEffect, useRef } from 'react';
import { Task, Tag } from '../types';
import { Play, Pause, RotateCcw, Coffee, Target, CheckCircle2, Volume2, VolumeX } from 'lucide-react';
import { hapticFeedback } from '../services/hapticService';

interface FocusViewProps {
  tasks: Task[];
  tags: Tag[];
  onCompleteSession: (taskId: string) => void;
}

const FocusView: React.FC<FocusViewProps> = ({ tasks, tags, onCompleteSession }) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Fix: Use 'any' to avoid the 'Cannot find namespace NodeJS' error in browser environments for setInterval return type
  const timerRef = useRef<any>(null);
  const activeTask = tasks.find(t => t.id === activeTaskId) || tasks.find(t => !t.completed);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (activeTask && !activeTaskId) {
      setActiveTaskId(activeTask.id);
    }
  }, [activeTask, activeTaskId]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerEnd();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const handleTimerEnd = () => {
    setIsActive(false);
    hapticFeedback.warning();
    
    if (!isMuted) {
      // Logic for playing sound would go here
    }

    if (isBreak) {
      setIsBreak(false);
      setTimeLeft(25 * 60);
      alert("Hết giờ giải lao! Quay lại làm việc nào.");
    } else {
      if (activeTaskId) onCompleteSession(activeTaskId);
      setIsBreak(true);
      setTimeLeft(5 * 60);
      alert("Tuyệt vời! Bạn đã hoàn thành 1 phiên làm việc. Hãy giải lao 5 phút.");
    }
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    hapticFeedback.light();
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
    hapticFeedback.medium();
  };

  return (
    <div className="flex flex-col h-full bg-orange-50 dark:bg-gray-900 rounded-lg p-4 lg:p-8 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pb-32 lg:pb-0">
      <div className="max-w-2xl mx-auto w-full flex flex-col items-center gap-8">
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-400 mb-2">Chế độ Tập trung</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pomodoro: 25 phút làm việc, 5 phút nghỉ ngơi</p>
        </div>

        {/* Timer Circle */}
        <div className="relative w-64 h-64 lg:w-80 lg:h-80 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-gray-200 dark:stroke-gray-800 fill-none"
              strokeWidth="8"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className={`fill-none transition-all duration-1000 ${isBreak ? 'stroke-green-500' : 'stroke-orange-500'}`}
              strokeWidth="8"
              strokeDasharray="283%"
              strokeDashoffset={`${(1 - timeLeft / (isBreak ? 5 * 60 : 25 * 60)) * 283}%`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <span className="text-5xl lg:text-7xl font-mono font-bold text-gray-800 dark:text-white">
               {formatTime(timeLeft)}
             </span>
             <span className={`text-sm font-bold mt-2 uppercase tracking-widest ${isBreak ? 'text-green-600' : 'text-orange-600'}`}>
               {isBreak ? 'Đang giải lao' : 'Đang tập trung'}
             </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsMuted(!isMuted)}
             className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-md text-gray-500 hover:text-orange-600 transition"
           >
             {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
           </button>
           <button 
             onClick={toggleTimer}
             className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-90 ${isActive ? 'bg-red-500' : 'bg-orange-600'}`}
           >
             {isActive ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
           </button>
           <button 
             onClick={resetTimer}
             className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-md text-gray-500 hover:text-orange-600 transition"
           >
             <RotateCcw size={24} />
           </button>
        </div>

        {/* Task Selection */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-orange-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
            <Target size={16} /> Công việc đang thực hiện
          </h3>
          
          {activeTask ? (
            <div className="flex items-center justify-between gap-4">
               <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                      {activeTask.time}
                    </span>
                    {activeTask.tags.slice(0, 1).map(tag => (
                      <span key={tag} className="text-[10px] uppercase font-bold text-gray-400">{tag}</span>
                    ))}
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">{activeTask.title}</h4>
               </div>
               <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">
                    {activeTask.pomodoroSessions || 0}
                    <span className="text-xs text-gray-400 font-normal ml-1">phiên</span>
                  </div>
               </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 italic">
               Không có công việc nào khả dụng
            </div>
          )}

          <div className="mt-6">
             <label className="text-xs font-bold text-gray-400 mb-2 block">Thay đổi mục tiêu:</label>
             <select 
               value={activeTaskId || ''}
               onChange={(e) => {
                 setActiveTaskId(e.target.value);
                 setIsActive(false);
                 setTimeLeft(25 * 60);
               }}
               className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm text-gray-700 dark:text-gray-300 outline-none"
             >
               {tasks.filter(t => !t.completed).map(t => (
                 <option key={t.id} value={t.id}>{t.title}</option>
               ))}
             </select>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FocusView;
