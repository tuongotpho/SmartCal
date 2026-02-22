import React from 'react';
import {
  format,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  endOfDay,
  getDay,
  getDate,
  getMonth,
  differenceInDays,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  startOfDay
} from 'date-fns';
import { Task, Tag, ViewMode } from '../types';
import { Trash2, Calendar as CalendarIcon, Edit3, Repeat, CheckCircle2, Circle, ListChecks, ArrowRight } from 'lucide-react';
import { generateGoogleCalendarLink } from '../services/googleCalendarService';
import { getLunarDate } from '../services/lunarService';

interface CalendarViewProps {
  currentDate: Date;
  viewMode: ViewMode;
  tasks: Task[];
  tags: Tag[];
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onMoveTask: (taskId: string, newDate: string) => void;
  onSelectDate?: (date: Date) => void;
  onTagClick: (tagName: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  currentDate,
  viewMode,
  tasks,
  tags,
  onDeleteTask,
  onEditTask,
  onToggleComplete,
  onMoveTask,
  onSelectDate,
  onTagClick
}) => {
  // Determine range based on ViewMode
  let startDate: Date;
  let endDate: Date;

  if (viewMode === ViewMode.WEEK) {
    startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
  } else if (viewMode === ViewMode.DAY) {
    startDate = startOfDay(currentDate);
    endDate = endOfDay(currentDate);
  } else {
    // Default to Month
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  }

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  // Grid Configuration
  let gridColsClass = 'grid-cols-7';
  let minHeightClass = 'min-h-[60px] sm:min-h-[100px]';

  if (viewMode === ViewMode.DAY) {
    gridColsClass = 'grid-cols-1';
    minHeightClass = 'min-h-[500px]';
  } else if (viewMode === ViewMode.WEEK) {
    minHeightClass = 'min-h-[400px]'; // Taller cells for week view
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Essential to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const newDateStr = format(day, 'yyyy-MM-dd');
      onMoveTask(taskId, newDateStr);
    }
  };

  return (
    // Removed pb-20 from here
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden select-none">
      {/* Header Days - Only show for Month and Week view */}
      {viewMode !== ViewMode.DAY && (
        <div className="grid grid-cols-7 bg-red-800 dark:bg-red-900 text-white flex-shrink-0">
          {weekDays.map((day) => (
            <div key={day} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold uppercase">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Days Grid - Added pb-32 lg:pb-0 here */}
      <div className={`grid ${gridColsClass} auto-rows-fr flex-1 bg-orange-100 dark:bg-gray-800 gap-[1px] overflow-y-auto pb-32 lg:pb-0`}>
        {days.map((day, idx) => {
          // Tính toán ngày Âm lịch
          const { lunarDate } = getLunarDate(day);
          // lunarDate format: "dd/MM (Nhuận)" hoặc "dd/MM"
          const lunarParts = lunarDate.split(' ')[0].split('/');
          const lunarDay = lunarParts[0];
          const lunarMonth = lunarParts[1];
          // Nếu là mùng 1 thì hiện "1/Month", ngược lại chỉ hiện ngày
          const lunarDisplay = lunarDay === '1' ? `${lunarDay}/${lunarMonth}` : lunarDay;
          const isLunarFirst = lunarDay === '1';

          // Logic lọc task: Hỗ trợ Multi-day và Recurring
          const dayTasks = tasks.filter(task => {
            const taskDateStart = startOfDay(new Date(task.date));
            const currentDayStart = startOfDay(day);
            const recType = task.recurringType || (task.isRecurring ? 'daily' : 'none');

            // Xử lý việc lặp lại (Chỉ kiểm tra ngày bắt đầu)
            if (recType !== 'none') {
              if (currentDayStart.getTime() < taskDateStart.getTime()) return false;
              switch (recType) {
                case 'daily': return true;
                case 'weekly': return getDay(currentDayStart) === getDay(taskDateStart);
                case 'monthly':
                  if (task.isLunarDate && task.lunarDay) {
                    return parseInt(lunarDay) === task.lunarDay;
                  }
                  return getDate(currentDayStart) === getDate(taskDateStart);
                case 'yearly':
                  if (task.isLunarDate && task.lunarDay && task.lunarMonth) {
                    return parseInt(lunarDay) === task.lunarDay && parseInt(lunarMonth) === task.lunarMonth;
                  }
                  return getDate(currentDayStart) === getDate(taskDateStart) && getMonth(currentDayStart) === getMonth(taskDateStart);
                default: return false;
              }
            } else {
              // Xử lý việc 1 lần và việc kéo dài nhiều ngày
              const taskDateEnd = task.endDate ? startOfDay(new Date(task.endDate)) : taskDateStart;
              // Check if current day is within start and end date
              return isWithinInterval(currentDayStart, { start: taskDateStart, end: taskDateEnd });
            }
          });

          // Sort tasks by time
          dayTasks.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

          return (
            <div
              key={day.toString()}
              onClick={() => onSelectDate && onSelectDate(day)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
              className={`${minHeightClass} bg-white dark:bg-gray-900 p-1 sm:p-2 flex flex-col relative transition-colors group/day cursor-pointer hover:bg-orange-50/50 dark:hover:bg-gray-800
                ${viewMode === ViewMode.MONTH && !isSameMonth(day, currentDate) ? 'text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-950' : 'text-gray-700 dark:text-gray-200'}
                ${isToday(day) ? 'bg-orange-50 dark:bg-gray-800' : ''}
              `}
            >
              <div className="flex justify-between items-start group relative mb-1 pointer-events-none w-full">
                {/* Left: Lunar Date (Âm lịch) */}
                {viewMode === ViewMode.DAY ? (
                  // Trong chế độ xem Ngày, không cần hiển thị ở đây vì đã có tiêu đề lớn
                  <div></div>
                ) : (
                  <span className={`text-[10px] leading-none mt-1 ml-0.5 ${isLunarFirst ? 'text-red-400 font-bold' : 'text-gray-300 dark:text-gray-500'}`}>
                    {lunarDisplay}
                  </span>
                )}

                {/* Right: Solar Date (Dương lịch) */}
                <div className="flex flex-col items-center sm:items-end z-10">
                  {viewMode === ViewMode.DAY ? (
                    <div className="flex flex-col items-center w-full">
                      <span className="text-lg font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                        {format(day, 'EEEE, dd/MM/yyyy')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        (Âm lịch: {lunarDate})
                      </span>
                    </div>
                  ) : (
                    <span className={`text-xs sm:text-sm font-semibold sm:p-1 ${isToday(day) ? 'bg-orange-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-md' : ''}`}>
                      {format(day, dateFormat)}
                    </span>
                  )}
                </div>
              </div>

              {/* Task List */}
              <div className={`flex flex-1 flex-col gap-1 overflow-y-auto custom-scrollbar ${viewMode === ViewMode.MONTH ? 'hidden sm:flex' : 'flex'}`}>
                {dayTasks.map(task => {
                  const isCompleted = task.completed;
                  const recType = task.recurringType || (task.isRecurring ? 'daily' : 'none');
                  const isRec = recType !== 'none';

                  // Use first tag for main color
                  const mainTagName = task.tags && task.tags.length > 0 ? task.tags[0] : 'Khác';
                  const tagConfig = tags.find(t => t.name === mainTagName) || tags.find(t => t.name === 'Khác');

                  const taskStart = startOfDay(new Date(task.date));
                  const taskEnd = task.endDate ? startOfDay(new Date(task.endDate)) : taskStart;
                  const isMultiDay = task.endDate && differenceInDays(taskEnd, taskStart) > 0 && !isRec;

                  // Multi-day styling logic
                  const currentDayStart = startOfDay(day);
                  let borderClass = 'rounded';
                  let marginClass = '';
                  let dayLabel = '';

                  if (isMultiDay && viewMode === ViewMode.MONTH) {
                    const isStartDay = isSameDay(currentDayStart, taskStart);
                    const isEndDay = isSameDay(currentDayStart, taskEnd);
                    const dayIndex = differenceInDays(currentDayStart, taskStart) + 1;
                    const totalDays = differenceInDays(taskEnd, taskStart) + 1;

                    if (isStartDay) {
                      borderClass = 'rounded-l rounded-r-none border-r-0';
                      marginClass = 'mr-[-5px] z-10'; // Overlap to right
                      dayLabel = `(1/${totalDays})`;
                    } else if (isEndDay) {
                      borderClass = 'rounded-r rounded-l-none border-l-0';
                      marginClass = 'ml-[-5px] z-10'; // Overlap to left
                      dayLabel = `(${dayIndex}/${totalDays})`;
                    } else {
                      borderClass = 'rounded-none border-x-0';
                      marginClass = 'mx-[-5px] z-0'; // Overlap both
                      dayLabel = `(${dayIndex}/${totalDays})`;
                    }
                  }

                  const colorClass = isCompleted
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-400 opacity-70'
                    : (tagConfig?.color || 'bg-orange-100 border-orange-300 text-orange-800');

                  // Subtask Progress
                  const totalSub = task.subtasks?.length || 0;
                  const doneSub = task.subtasks?.filter(s => s.completed).length || 0;

                  return (
                    <div
                      key={`${task.id}-${idx}-desktop`}
                      draggable={!isRec}
                      onDragStart={(e) => handleDragStart(e, task)}
                      className={`group/task flex flex-col justify-center border-l-4 text-xs p-1.5 hover:opacity-90 transition-all cursor-grab active:cursor-grabbing relative shadow-sm pr-1 mb-1
                        ${colorClass} ${borderClass} ${marginClass}
                        ${viewMode === ViewMode.DAY ? 'p-3 text-sm border-l-8' : ''}
                      `}
                      onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                      title={`${task.title} ${isMultiDay ? dayLabel : ''}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="truncate flex-1 pr-1 flex items-center gap-2">
                          {isCompleted && <CheckCircle2 size={viewMode === ViewMode.DAY ? 16 : 10} className="text-green-500 flex-shrink-0" />}
                          {/* Remove opacity for Time in Dark Mode */}
                          <span className={`font-bold whitespace-nowrap opacity-80 dark:opacity-100 ${viewMode === ViewMode.DAY ? 'text-base' : ''}`}>{task.time}</span>
                          <span className={`truncate font-medium ${viewMode === ViewMode.DAY ? 'text-base' : ''}`}>{task.title}</span>
                        </div>
                      </div>

                      {/* Description & Details (Visible more in Day View) */}
                      {(viewMode === ViewMode.DAY || viewMode === ViewMode.WEEK) && task.description && (
                        <div className="mt-1 text-xs opacity-70 dark:opacity-90 line-clamp-2 pl-1">
                          {task.description}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 opacity-80 dark:opacity-100">
                        {/* Multi-day indicator */}
                        {isMultiDay && (
                          <span className="text-[9px] font-bold bg-white/30 px-1 rounded flex items-center gap-0.5">
                            <ArrowRight size={8} /> {dayLabel}
                          </span>
                        )}

                        {/* Subtask Indicator */}
                        {totalSub > 0 && (
                          <div className="flex items-center gap-1">
                            <ListChecks size={viewMode === ViewMode.DAY ? 12 : 8} />
                            <span className="text-[9px] font-semibold">{doneSub}/{totalSub}</span>
                          </div>
                        )}

                        {/* Multi Tags Dots (Max 3) */}
                        <div className="flex gap-0.5 ml-auto">
                          {(task.tags || []).slice(0, 3).map((tagName, i) => {
                            const tConf = tags.find(t => t.name === tagName);
                            return (
                              <span
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${tConf?.dot || 'bg-gray-400'} cursor-pointer hover:ring-1 hover:ring-gray-400`}
                                onClick={(e) => { e.stopPropagation(); onTagClick(tagName); }}
                                title={`Lọc: ${tagName}`}
                              ></span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Hover Menu */}
                      <div className="hidden group-hover/task:flex items-center bg-white/95 dark:bg-gray-800/95 rounded shadow-sm absolute right-1 top-1 z-20 border border-gray-100 dark:border-gray-700">
                        <button onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }} className={`p-1 rounded ${isCompleted ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}>
                          {isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onEditTask(task); }} className="p-1 text-gray-500 hover:text-orange-600 rounded"><Edit3 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} className="p-1 text-red-500 hover:text-red-700 rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile View: Dots Only (Only for Month View) */}
              {viewMode === ViewMode.MONTH && (
                <div className="flex sm:hidden flex-wrap justify-center gap-0.5 content-start mt-1 pointer-events-none">
                  {dayTasks.slice(0, 6).map(task => {
                    const mainTagName = task.tags && task.tags.length > 0 ? task.tags[0] : 'Khác';
                    const tagConfig = tags.find(t => t.name === mainTagName) || tags.find(t => t.name === 'Khác');
                    return (
                      <div
                        key={`${task.id}-${idx}-mobile`}
                        className={`w-1.5 h-1.5 rounded-full ${task.completed ? 'bg-gray-300 dark:bg-gray-600' : (tagConfig?.dot || 'bg-orange-500')}`}
                      />
                    )
                  })}
                  {dayTasks.length > 6 && <span className="text-[8px] text-gray-400 leading-none">+</span>}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(CalendarView);