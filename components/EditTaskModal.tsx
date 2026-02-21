
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, RecurringType, Tag, Subtask } from '../types';
import { X, Save, Calendar, Clock, FileText, Type, Repeat, CheckCircle2, Tag as TagIcon, ListChecks, Plus, Trash2, CheckSquare, Square, ArrowRight, Mic, MicOff, Sparkles, RefreshCw, Wand2, ExternalLink, Moon, Sun } from 'lucide-react';
import { ToastType } from './Toast';
import { parseTaskWithGemini, suggestSubtasks } from '../services/geminiService';
import { lunarToSolar, solarToLunar } from '../services/lunarService';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  tags: Tag[];
  onSave: (updatedTask: Task) => void;
  showToast: (message: string, type: ToastType) => void;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ isOpen, onClose, task, tags, onSave, showToast }) => {
  const [formData, setFormData] = useState<Task | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Lunar calendar state
  const [isLunarMode, setIsLunarMode] = useState(false);
  const [lunarDay, setLunarDay] = useState(1);
  const [lunarMonth, setLunarMonth] = useState(1);
  const [lunarYear, setLunarYear] = useState(new Date().getFullYear());

  // Voice & AI State
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const transcriptBufferRef = useRef<string>("");

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        title: task.title || '',
        description: task.description || '',
        duration: task.duration || '',
        endDate: task.endDate || task.date,
        recurringType: task.recurringType || (task.isRecurring ? 'daily' : 'none'),
        tags: (task.tags && task.tags.length > 0) ? task.tags : ['Khác'],
        subtasks: task.subtasks || []
      });
      // Restore lunar mode if task was saved with lunar date
      if (task.isLunarDate && task.lunarDay && task.lunarMonth && task.lunarYear) {
        setIsLunarMode(true);
        setLunarDay(task.lunarDay);
        setLunarMonth(task.lunarMonth);
        setLunarYear(task.lunarYear);
      } else {
        setIsLunarMode(false);
        // Parse current solar date to init lunar dropdowns
        const parts = (task.date || '').split('-');
        if (parts.length === 3) {
          const lunar = solarToLunar(parseInt(parts[2]), parseInt(parts[1]), parseInt(parts[0]));
          setLunarDay(lunar.day);
          setLunarMonth(lunar.month);
          setLunarYear(lunar.year);
        }
      }
    }
  }, [task]);

  const toggleTag = (tagName: string) => {
    if (!formData) return;
    const currentTags = formData.tags || [];
    let newTags = [];
    if (currentTags.includes(tagName)) {
      newTags = currentTags.filter(t => t !== tagName);
    } else {
      newTags = [...currentTags, tagName];
    }
    setFormData({ ...formData, tags: newTags });
  };

  // Voice Input Logic
  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast("Trình duyệt không hỗ trợ nhận diện giọng nói.", "error");
        return;
      }
      transcriptBufferRef.current = "";

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = async () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        const text = transcriptBufferRef.current.trim();
        if (text) {
          await processAIInput(text);
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 1500);

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcriptBufferRef.current += event.results[i][0].transcript + " ";
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error(event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          showToast("Lỗi nhận diện giọng nói", "error");
        }
      };

      recognitionRef.current.start();
    }
  };

  const processAIInput = async (text: string) => {
    if (!formData) return;
    setIsProcessingAI(true);
    try {
      const availableTags = tags.map(t => t.name);
      const results = await parseTaskWithGemini(text, availableTags);

      if (results && results.length > 0) {
        const result = results[0];
        setFormData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            title: result.title,
            date: result.date,
            endDate: result.endDate || result.date,
            time: result.time,
            description: (prev.description ? prev.description + "\n" : "") + (result.description || ""),
            recurringType: (result.recurringType as RecurringType) || 'none',
            tags: result.tags || ['Khác']
          };
        });
        showToast("Đã điền thông tin từ giọng nói!", "success");
        if (results.length > 1) {
          showToast(`AI tìm thấy ${results.length} công việc, chỉ lấy thông tin đầu tiên.`, "info");
        }
      } else {
        showToast("AI không trích xuất được thông tin.", "warning");
        setFormData(prev => prev ? ({ ...prev, title: text }) : null);
      }
    } catch (e) {
      showToast("Lỗi xử lý AI.", "error");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSmartBreakdown = async () => {
    if (!formData?.title) {
      showToast("Vui lòng nhập tiêu đề trước khi dùng AI.", "warning");
      return;
    }
    setIsGeneratingSubtasks(true);
    try {
      const suggestions = await suggestSubtasks(formData.title, formData.description);
      if (suggestions.length > 0) {
        const newSubtasks: Subtask[] = suggestions.map(title => ({
          id: Date.now().toString() + Math.random().toString(),
          title: title,
          completed: false
        }));

        setFormData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            subtasks: [...(prev.subtasks || []), ...newSubtasks]
          };
        });
        showToast(`Đã thêm ${suggestions.length} bước nhỏ.`, "success");
      } else {
        showToast("AI không nghĩ ra bước nào cả :(", "info");
      }
    } catch (e) {
      showToast("Lỗi kết nối AI.", "error");
    } finally {
      setIsGeneratingSubtasks(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim() || !formData) return;
    const newSubtask: Subtask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      completed: false
    };
    setFormData({
      ...formData,
      subtasks: [...(formData.subtasks || []), newSubtask]
    });
    setNewSubtaskTitle("");
  };

  const handleToggleSubtask = (subtaskId: string) => {
    if (!formData || !formData.subtasks) return;
    const updatedSubtasks = formData.subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setFormData({ ...formData, subtasks: updatedSubtasks });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    if (!formData || !formData.subtasks) return;
    const updatedSubtasks = formData.subtasks.filter(st => st.id !== subtaskId);
    setFormData({ ...formData, subtasks: updatedSubtasks });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!formData) return;
    const newDate = e.target.value;
    let newEndDate = formData.endDate;
    if (newEndDate && newEndDate < newDate) {
      newEndDate = newDate;
    }
    setFormData({ ...formData, date: newDate, endDate: newEndDate, isLunarDate: false });
  }

  // Lunar date change handler
  const handleLunarDateChange = (day: number, month: number, year: number) => {
    if (!formData) return;
    setLunarDay(day);
    setLunarMonth(month);
    setLunarYear(year);
    // Convert to solar and update formData
    const solar = lunarToSolar(day, month, year, false);
    if (solar.day > 0) {
      const solarDateStr = `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
      setFormData({
        ...formData,
        date: solarDateStr,
        endDate: solarDateStr,
        isLunarDate: true,
        lunarDay: day,
        lunarMonth: month,
        lunarYear: year
      });
    }
  };

  // Solar preview when in lunar mode
  const lunarSolarPreview = useMemo(() => {
    const solar = lunarToSolar(lunarDay, lunarMonth, lunarYear, false);
    if (solar.day === 0) return 'Ngày không hợp lệ';
    return `${String(solar.day).padStart(2, '0')}/${String(solar.month).padStart(2, '0')}/${solar.year}`;
  }, [lunarDay, lunarMonth, lunarYear]);

  if (!isOpen || !formData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-orange-950/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-orange-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {formData.id === 'temp' ? 'Thêm công việc mới' : 'Chỉnh sửa công việc'}
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Title Input with Voice Button */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1"><Type size={14} /> Tiêu đề</span>
              {isListening && <span className="text-red-500 animate-pulse flex items-center gap-1"><Mic size={12} /> Đang nghe...</span>}
              {isProcessingAI && <span className="text-blue-500 animate-pulse flex items-center gap-1"><Sparkles size={12} /> Đang phân tích...</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="VD: Họp team vào 9h sáng mai"
                className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                autoFocus={formData.id === 'temp'}
              />
              <button
                onClick={toggleVoiceInput}
                disabled={isProcessingAI}
                className={`p-2 rounded border transition-all shadow-sm flex-shrink-0
                        ${isListening
                    ? 'bg-red-500 text-white border-red-600 animate-pulse ring-2 ring-red-200'
                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:text-orange-600 hover:border-orange-300'
                  }
                        ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                title="Nhập bằng giọng nói (AI)"
              >
                {isProcessingAI ? <RefreshCw size={18} className="animate-spin text-blue-500" /> : (isListening ? <MicOff size={18} /> : <Mic size={18} />)}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 italic">
              * Mẹo: Tự động ngắt sau 1.5s im lặng.
            </p>
          </div>

          {/* Date Range Section */}
          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            {/* Lunar/Solar Toggle */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                {isLunarMode ? <Moon size={14} className="text-yellow-500" /> : <Sun size={14} className="text-orange-500" />}
                {isLunarMode ? 'Âm lịch' : 'Dương lịch'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsLunarMode(!isLunarMode);
                  if (!isLunarMode && formData) {
                    // Switching to Lunar: convert current solar date to lunar
                    const parts = formData.date.split('-');
                    if (parts.length === 3) {
                      const lunar = solarToLunar(parseInt(parts[2]), parseInt(parts[1]), parseInt(parts[0]));
                      setLunarDay(lunar.day);
                      setLunarMonth(lunar.month);
                      setLunarYear(lunar.year);
                    }
                  }
                }}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isLunarMode ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isLunarMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
              </button>
            </div>

            {isLunarMode ? (
              /* Lunar Date Dropdowns */
              <div className="space-y-2">
                <div className="flex gap-2">
                  {/* Ngày Âm */}
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Ngày</label>
                    <select
                      value={lunarDay}
                      onChange={(e) => handleLunarDateChange(parseInt(e.target.value), lunarMonth, lunarYear)}
                      className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-yellow-500 outline-none"
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {/* Tháng Âm */}
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Tháng</label>
                    <select
                      value={lunarMonth}
                      onChange={(e) => handleLunarDateChange(lunarDay, parseInt(e.target.value), lunarYear)}
                      className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-yellow-500 outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                  </div>
                  {/* Năm (Dương) */}
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Năm</label>
                    <select
                      value={lunarYear}
                      onChange={(e) => handleLunarDateChange(lunarDay, lunarMonth, parseInt(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-yellow-500 outline-none"
                    >
                      {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Solar Preview */}
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded border border-yellow-200 dark:border-yellow-800">
                  <Sun size={12} className="text-orange-400" />
                  Dương lịch: <span className="font-semibold text-gray-700 dark:text-gray-200">{lunarSolarPreview}</span>
                </div>
              </div>
            ) : (
              /* Solar Date Inputs (Original) */
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Calendar size={14} /> Bắt đầu
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={handleStartDateChange}
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="pt-5 text-gray-400">
                  <ArrowRight size={16} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                    Kết thúc
                  </label>
                  <input
                    type="date"
                    min={formData.date}
                    value={formData.endDate || formData.date}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Time Picker */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Clock size={14} /> Giờ (áp dụng cho ngày bắt đầu)
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Recurring Select */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                <Repeat size={14} /> Lặp lại
              </label>
              <select
                value={formData.recurringType || 'none'}
                onChange={(e) => setFormData({ ...formData, recurringType: e.target.value as RecurringType })}
                className="w-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-semibold rounded px-2 py-2.5 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
              >
                <option value="none" className="bg-white dark:bg-gray-800">Không lặp lại</option>
                <option value="daily" className="bg-white dark:bg-gray-800">Hàng ngày</option>
                <option value="weekly" className="bg-white dark:bg-gray-800">Hàng tuần</option>
                <option value="monthly" className="bg-white dark:bg-gray-800">Hàng tháng</option>
                <option value="yearly" className="bg-white dark:bg-gray-800">Hàng năm</option>
              </select>
            </div>

            {/* Multi-Tag Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                <TagIcon size={14} /> Phân loại (Chọn nhiều)
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => {
                  const isSelected = (formData.tags || []).includes(t.name);
                  return (
                    <button
                      key={t.name}
                      onClick={() => toggleTag(t.name)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${isSelected
                        ? `${t.color} border-current ring-1 ring-offset-1 dark:ring-offset-gray-800 font-bold shadow-sm`
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? t.dot : 'bg-gray-300'}`}></span>
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Completed Toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <CheckCircle2 size={14} /> Trạng thái
            </label>
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded border border-green-100 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition" onClick={() => setFormData({ ...formData, completed: !formData.completed })}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.completed ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'}`}>
                {formData.completed && <CheckCircle2 size={10} className="text-white" />}
              </div>
              <span className="text-xs font-bold text-green-900 dark:text-green-300">{formData.completed ? "Đã hoàn thành" : "Đang thực hiện"}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
              <FileText size={14} /> Chi tiết / Ghi chú
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
            />
          </div>

          {/* Subtasks Section */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                <ListChecks size={14} /> Công việc con (Checklist)
              </label>
              <button
                onClick={handleSmartBreakdown}
                disabled={isGeneratingSubtasks}
                className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition shadow-sm"
                title="Dùng AI để chia nhỏ công việc"
              >
                {isGeneratingSubtasks ? <RefreshCw size={10} className="animate-spin" /> : <Wand2 size={10} />}
                {isGeneratingSubtasks ? "Đang tạo..." : "AI Chia nhỏ"}
              </button>
            </div>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Thêm bước nhỏ..."
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              />
              <button onClick={handleAddSubtask} className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-1.5 rounded hover:bg-orange-200 dark:hover:bg-orange-900/50 transition">
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-1.5 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 min-h-[50px]">
              {formData.subtasks && formData.subtasks.length > 0 ? (
                formData.subtasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded border border-gray-100 dark:border-gray-600 shadow-sm group">
                    <button
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`text-gray-400 dark:text-gray-500 hover:text-green-600 transition ${st.completed ? 'text-green-500 dark:text-green-400' : ''}`}
                    >
                      {st.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <span className={`flex-1 text-xs ${st.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                      {st.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="text-gray-300 dark:text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-gray-400 text-center py-2">Chưa có checklist</p>
              )}
            </div>
          </div>



        </div>

        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium transition"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              if (!formData.title || !formData.date) {
                showToast("Vui lòng nhập tiêu đề và ngày bắt đầu", "warning");
                return;
              }
              const finalTags = formData.tags && formData.tags.length > 0 ? formData.tags : ['Khác'];
              onSave({ ...formData, tags: finalTags });
              onClose();
            }}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition shadow-md text-sm font-medium"
          >
            <Save size={16} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTaskModal;
