
import React, { useState, useRef, useMemo } from 'react';
import {
  CalendarPlus,
  PenLine,
  Sparkles,
  Mic,
  MicOff,
  RefreshCw,
  ChevronRight,
  Plus,
  BarChart3,
  Bot,
  Moon,
  Sun
} from 'lucide-react';
import { format, addDays, isValid } from 'date-fns';
import { Task, RecurringType, Tag, Subtask } from '../types';
import { parseTaskWithGemini } from '../services/geminiService';
import { ToastType } from './Toast';
import { lunarToSolar, solarToLunar } from '../services/lunarService';

interface SidebarProps {
  onAddTask: (task: Task) => Promise<void>;
  onGenerateReport: () => void;
  isReportLoading: boolean;
  aiReport: string | null;
  tags: Tag[];
  user: any;
  isOfflineMode: boolean;
  isDarkMode: boolean;
  showToast: (message: string, type: ToastType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onAddTask,
  onGenerateReport,
  isReportLoading,
  aiReport,
  tags,
  user,
  isOfflineMode,
  isDarkMode,
  showToast
}) => {
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'manual'>('manual');

  // Quick Input State
  const [quickInput, setQuickInput] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Voice Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    duration: '',
    tag: 'Khác',
    recurringType: 'none' as RecurringType,
    description: '',
    checklistText: ''
  });

  // Lunar calendar state
  const [isLunarMode, setIsLunarMode] = useState(false);
  const [lunarDay, setLunarDay] = useState(() => {
    const now = new Date();
    const l = solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    return l.day;
  });
  const [lunarMonth, setLunarMonth] = useState(() => {
    const now = new Date();
    const l = solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    return l.month;
  });
  const [lunarYear, setLunarYear] = useState(new Date().getFullYear());

  const handleLunarChange = (day: number, month: number, year: number) => {
    setLunarDay(day);
    setLunarMonth(month);
    setLunarYear(year);
    const solar = lunarToSolar(day, month, year, false);
    if (solar.day > 0) {
      const solarStr = `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
      setManualForm(prev => ({ ...prev, date: solarStr, endDate: solarStr }));
    }
  };

  const lunarSolarPreview = useMemo(() => {
    const solar = lunarToSolar(lunarDay, lunarMonth, lunarYear, false);
    if (solar.day === 0) return 'Ngày không hợp lệ';
    return `${String(solar.day).padStart(2, '0')}/${String(solar.month).padStart(2, '0')}/${solar.year}`;
  }, [lunarDay, lunarMonth, lunarYear]);

  // --- Voice Input Logic ---
  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.", "error");
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current.onresult = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 1500);

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }

        if (finalTranscript) {
          setQuickInput(prev => (prev ? prev + "" : "") + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      recognitionRef.current.start();
    }
  };

  // --- Parser Logic ---
  const parseManualInput = (input: string): { title: string; date: string; time: string } => {
    let text = input;
    const now = new Date();
    let targetDate = now;
    let targetTime = format(now, "HH:mm");

    const timeRegex = /(?:lúc\s+)?(\d{1,2})[:h](\d{2})?(?:\s*(?:sáng|chiều|tối|đêm))?/i;
    const timeMatch = text.match(timeRegex);

    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = (timeMatch[0].toLowerCase().match(/chiều|tối|đêm/) && hours < 12) ? 'pm' : 'am';

      if (period === 'pm') hours += 12;
      if (hours >= 24) hours = 23;
      if (minutes >= 60) minutes = 59;

      targetTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      text = text.replace(timeMatch[0], "").trim();
    } else {
      // Fallback: Kiểm tra xem có từ khóa chung chung không
      const lowerTextForTime = text.toLowerCase();
      if (lowerTextForTime.includes("sáng")) {
        targetTime = "08:00";
        text = text.replace(/sáng/gi, "").trim();
      } else if (lowerTextForTime.includes("trưa")) {
        targetTime = "12:00";
        text = text.replace(/trưa/gi, "").trim();
      } else if (lowerTextForTime.includes("chiều")) {
        targetTime = "14:00";
        text = text.replace(/chiều/gi, "").trim();
      } else if (lowerTextForTime.includes("tối")) {
        targetTime = "19:00";
        text = text.replace(/tối/gi, "").trim();
      } else if (lowerTextForTime.includes("đêm")) {
        targetTime = "22:00";
        text = text.replace(/đêm/gi, "").trim();
      } else {
        targetTime = "08:00";
      }
    }

    const lowerText = text.toLowerCase();
    let dateFound = false;

    if (lowerText.includes("hôm nay") || lowerText.includes("nay")) {
      targetDate = now;
      text = text.replace(/hôm nay|nay/gi, "").trim();
      dateFound = true;
    } else if (lowerText.includes("ngày mai") || lowerText.includes("mai")) {
      targetDate = addDays(now, 1);
      text = text.replace(/ngày mai|mai/gi, "").trim();
      dateFound = true;
    } else if (lowerText.includes("ngày kia") || lowerText.includes("mốt")) {
      targetDate = addDays(now, 2);
      text = text.replace(/ngày kia|mốt/gi, "").trim();
      dateFound = true;
    }

    if (!dateFound) {
      const dateRegex = /(?:ngày\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/;
      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
        if (year < 100) year += 2000;
        const parsedDate = new Date(year, month, day);
        if (isValid(parsedDate)) {
          targetDate = parsedDate;
          text = text.replace(dateMatch[0], "").trim();
        }
      }
    }

    text = text.replace(/\s+(vào|lúc)\s*$/i, "").replace(/^\s*(vào|lúc)\s+/i, "").trim();
    if (!text) text = "Công việc mới";

    return {
      title: text,
      date: format(targetDate, 'yyyy-MM-dd'),
      time: targetTime
    };
  };

  const handleQuickAdd = async () => {
    if (!quickInput.trim()) return;
    setIsProcessingAI(true);

    try {
      // 1. AI Parsing
      let aiSuccess = false;
      try {
        const availableTags = tags.map(t => t.name);
        const aiResults = await parseTaskWithGemini(quickInput, availableTags);

        if (aiResults && aiResults.length > 0) {
          let addedCount = 0;
          for (const result of aiResults) {
            const newTask: Task = {
              id: "temp",
              userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
              title: result.title,
              date: result.date,
              time: result.time,
              duration: result.duration || "",
              description: result.description || "Tạo nhanh qua AI Assistant",
              completed: false,
              reminderSent: false,
              recurringType: (result.recurringType as RecurringType) || 'none',
              tags: result.tags || ['Khác'],
              subtasks: []
            };
            await onAddTask(newTask);
            addedCount++;
          }
          aiSuccess = true;
          setQuickInput("");
          showToast(`Đã tạo ${addedCount} công việc!`, "success");
        }
      } catch (error) {
        console.warn("AI failed, falling back to manual parser", error);
      }

      if (aiSuccess) return;

      // 2. Manual Parsing Fallback
      const manualResult = parseManualInput(quickInput);
      const taskData = {
        ...manualResult,
        description: "Tạo nhanh",
        tags: ['Khác']
      };

      const newTask: Task = {
        id: "temp",
        userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
        title: taskData.title,
        date: taskData.date,
        time: taskData.time,
        duration: "",
        description: taskData.description,
        completed: false,
        reminderSent: false,
        recurringType: 'none',
        tags: taskData.tags,
        subtasks: []
      };

      await onAddTask(newTask);
      setQuickInput("");

    } catch (e) {
      showToast("Lỗi không xác định khi tạo công việc.", "error");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.title.trim()) {
      showToast("Vui lòng nhập tiêu đề công việc", "warning");
      return;
    }
    setIsProcessingAI(true); // Reuse state for loading

    let subtasks: Subtask[] = [];
    if (manualForm.checklistText.trim()) {
      subtasks = manualForm.checklistText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => ({
          id: Date.now().toString() + Math.random().toString(),
          title: line,
          completed: false
        }));
    }

    const newTask: Task = {
      id: "temp",
      userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
      title: manualForm.title.trim(),
      date: manualForm.date,
      endDate: manualForm.endDate || manualForm.date,
      time: manualForm.time || "08:00",
      duration: manualForm.duration.trim(),
      description: manualForm.description.trim() || "Tạo thủ công",
      completed: false,
      reminderSent: false,
      recurringType: manualForm.recurringType,
      tags: [manualForm.tag],
      subtasks: subtasks,
      ...(isLunarMode ? { isLunarDate: true, lunarDay, lunarMonth, lunarYear } : {})
    };

    try {
      await onAddTask(newTask);
      setManualForm({
        ...manualForm,
        title: '',
        description: '',
        checklistText: '',
        duration: ''
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* Quick Add Area */}
      <div className="p-4 bg-primary-50 dark:bg-gray-800 border-b border-primary-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="font-bold text-primary-800 dark:text-primary-400 flex items-center gap-2 mb-3">
          <CalendarPlus size={16} className="text-primary-500" /> Thêm công việc mới
        </h2>

        <div className="flex gap-1 mb-3 bg-white dark:bg-gray-700 p-1 rounded-lg border border-primary-100 dark:border-gray-600 shadow-sm">
          <button
            onClick={() => setSidebarTab('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'manual'
              ? 'bg-primary-100 dark:bg-gray-600 text-primary-700 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
          >
            <PenLine size={12} /> Thủ công
          </button>
          <button
            onClick={() => setSidebarTab('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'ai'
              ? 'bg-primary-100 dark:bg-gray-600 text-primary-700 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
          >
            <Sparkles size={12} /> AI Nhập nhanh
          </button>
        </div>

        {sidebarTab === 'ai' ? (
          <div className="relative animate-in fade-in zoom-in-95 duration-200">
            <textarea
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="VD: Họp 9h sáng mai... (AI sẽ kiểm tra xung đột lịch cho bạn)"
              style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
              className="w-full border border-primary-200 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none min-h-[120px] resize-none shadow-inner bg-white dark:bg-gray-700 dark:text-white"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(); } }}
            />
            <button onClick={toggleVoiceInput} className={`absolute bottom-2 left-2 p-1.5 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:text-primary-600 border dark:border-gray-500'}`}>
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button onClick={handleQuickAdd} disabled={isProcessingAI || !quickInput.trim()} className={`absolute bottom-2 right-2 p-1.5 rounded-md transition-all shadow-sm ${isProcessingAI ? 'bg-gray-200 dark:bg-gray-600' : 'bg-primary-600 text-white'}`}>
              {isProcessingAI ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
            </button>
            {isProcessingAI && <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-lg z-10"><RefreshCw className="animate-spin text-primary-600" size={24} /></div>}
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1 relative">
            <div>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="Tiêu đề công việc"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              {/* Lunar/Solar Toggle */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  {isLunarMode ? <Moon size={10} className="text-yellow-500" /> : <Sun size={10} className="text-orange-500" />}
                  {isLunarMode ? 'Âm lịch' : 'Dương lịch'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLunarMode(!isLunarMode);
                    if (!isLunarMode) {
                      const parts = manualForm.date.split('-');
                      if (parts.length === 3) {
                        const lunar = solarToLunar(parseInt(parts[2]), parseInt(parts[1]), parseInt(parts[0]));
                        setLunarDay(lunar.day);
                        setLunarMonth(lunar.month);
                        setLunarYear(lunar.year);
                      }
                    }
                  }}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${isLunarMode ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${isLunarMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {isLunarMode ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className="text-[9px] text-gray-400">Ngày</label>
                      <select value={lunarDay} onChange={(e) => handleLunarChange(parseInt(e.target.value), lunarMonth, lunarYear)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs focus:ring-2 focus:ring-yellow-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400">Tháng</label>
                      <select value={lunarMonth} onChange={(e) => handleLunarChange(lunarDay, parseInt(e.target.value), lunarYear)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs focus:ring-2 focus:ring-yellow-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>T{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400">Năm</label>
                      <select value={lunarYear} onChange={(e) => handleLunarChange(lunarDay, lunarMonth, parseInt(e.target.value))} className="w-full border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-xs focus:ring-2 focus:ring-yellow-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                        {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-200 dark:border-yellow-800">
                    <Sun size={10} className="text-orange-400" /> Dương lịch: <span className="font-semibold text-gray-600 dark:text-gray-200">{lunarSolarPreview}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={manualForm.date}
                      onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Ngày kết thúc</label>
                    <input
                      type="date"
                      min={manualForm.date}
                      value={manualForm.endDate}
                      onChange={(e) => setManualForm({ ...manualForm, endDate: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Giờ</label>
                <input
                  type="time"
                  value={manualForm.time}
                  onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Phân loại</label>
                <select
                  value={manualForm.tag}
                  onChange={(e) => setManualForm({ ...manualForm, tag: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                >
                  {tags.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Lặp lại</label>
              <select
                value={manualForm.recurringType}
                onChange={(e) => setManualForm({ ...manualForm, recurringType: e.target.value as RecurringType })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="none">Không lặp lại</option>
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="yearly">Hàng năm</option>
              </select>
            </div>

            <div>
              <textarea
                rows={2}
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Chi tiết / Ghi chú..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>

            <button
              onClick={handleManualSubmit}
              disabled={isProcessingAI}
              className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isProcessingAI ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Tạo công việc
            </button>
            {isProcessingAI && <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30 flex items-center justify-center rounded-lg z-10"></div>}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-primary-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <button
          onClick={onGenerateReport}
          disabled={isReportLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition font-medium text-sm active:scale-95"
        >
          {isReportLoading ? <RefreshCw size={14} className="animate-spin" /> : <BarChart3 size={14} />}
          Phân tích & Báo cáo
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {aiReport && (
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <div className="font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1 border-b border-indigo-200 dark:border-indigo-800 pb-1 text-sm">
              <Bot size={14} /> Báo cáo AI:
            </div>
            <div
              className="text-xs leading-relaxed space-y-2 [&>h4]:font-bold [&>h4]:text-indigo-700 dark:[&>h4]:text-indigo-400 [&>h4]:mt-2 [&>h4]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-1"
              dangerouslySetInnerHTML={{ __html: aiReport }}
            />
          </div>
        )}
      </div>

      <div className="p-2 border-t border-primary-100 dark:border-gray-800 text-[10px] text-center text-gray-400 bg-primary-50 dark:bg-gray-800 flex-shrink-0">
        v2.8.0 • SmartCal Pro • AI Conflict Control
      </div>
    </div>
  );
};

export default React.memo(Sidebar);
