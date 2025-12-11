import React, { useMemo } from 'react';
import { Task, Tag } from '../types';
import { 
  format, 
  endOfMonth, 
  isWithinInterval,
  startOfMonth
} from 'date-fns';
import { PieChart, CheckCircle2, Circle, TrendingUp, AlertCircle, Target } from 'lucide-react';

interface StatsViewProps {
  currentDate: Date;
  tasks: Task[];
  tags: Tag[];
}

// Map Tailwind colors to Hex for Chart
const TAILWIND_COLOR_MAP: Record<string, string> = {
  'bg-red-500': '#ef4444',
  'bg-orange-500': '#f97316',
  'bg-amber-500': '#f59e0b',
  'bg-yellow-500': '#eab308',
  'bg-green-500': '#22c55e',
  'bg-emerald-500': '#10b981',
  'bg-teal-500': '#14b8a6',
  'bg-cyan-500': '#06b6d4',
  'bg-blue-500': '#3b82f6',
  'bg-indigo-500': '#6366f1',
  'bg-violet-500': '#8b5cf6',
  'bg-purple-500': '#a855f7',
  'bg-fuchsia-500': '#d946ef',
  'bg-pink-500': '#ec4899',
  'bg-rose-500': '#f43f5e',
  'bg-gray-500': '#6b7280',
};

const StatsView: React.FC<StatsViewProps> = ({ currentDate, tasks, tags }) => {
  // 1. Filter tasks for current month
  const monthStats = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Filter tasks within this month
    const tasksInMonth = tasks.filter(t => {
      const tDate = new Date(t.date);
      return isWithinInterval(tDate, { start, end });
    });

    const total = tasksInMonth.length;
    const completed = tasksInMonth.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Group by Tag
    const tagCounts: Record<string, number> = {};
    tasksInMonth.forEach(t => {
      const tagName = t.tag || 'Khác';
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    });

    // Format data for chart
    const chartData = Object.entries(tagCounts)
      .map(([name, count]) => {
        const tag = tags.find(t => t.name === name);
        return {
          name,
          count,
          percentage: (count / total) * 100,
          color: tag ? (TAILWIND_COLOR_MAP[tag.dot] || '#cbd5e1') : '#cbd5e1',
          tailwindDot: tag?.dot || 'bg-gray-400'
        };
      })
      .sort((a, b) => b.count - a.count); // Sort desc

    return { total, completed, pending, completionRate, chartData, tasksInMonth };
  }, [currentDate, tasks, tags]);

  // 2. Generate Conic Gradient String for Chart
  const gradientString = useMemo(() => {
    if (monthStats.total === 0) return 'conic-gradient(#f3f4f6 0% 100%)';
    
    let currentDeg = 0;
    const segments = monthStats.chartData.map(item => {
      const start = currentDeg;
      const deg = (item.count / monthStats.total) * 360;
      currentDeg += deg;
      return `${item.color} ${start}deg ${currentDeg}deg`;
    });
    
    return `conic-gradient(${segments.join(', ')})`;
  }, [monthStats]);

  return (
    <div className="flex flex-col h-full bg-orange-50 rounded-lg overflow-y-auto p-3 lg:p-4 gap-4 animate-in fade-in duration-300 pb-32 lg:pb-0">
      <div className="flex items-center justify-between">
         <h2 className="text-lg lg:text-xl font-bold text-orange-800 flex items-center gap-2">
           <TrendingUp className="text-orange-600" /> Thống kê Tháng {format(currentDate, 'MM/yyyy')}
         </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-orange-100 flex flex-row sm:flex-col items-center justify-between sm:justify-center">
          <div className="text-gray-500 text-xs font-semibold uppercase mb-0 sm:mb-1">Tổng việc</div>
          <div className="text-2xl lg:text-3xl font-bold text-gray-800">{monthStats.total}</div>
          <div className="text-[10px] text-gray-400 mt-0 sm:mt-1">công việc</div>
        </div>
        <div className="bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-orange-100 flex flex-row sm:flex-col items-center justify-between sm:justify-center">
          <div className="text-green-600 text-xs font-semibold uppercase mb-0 sm:mb-1">Đã xong</div>
          <div className="text-2xl lg:text-3xl font-bold text-green-600">{monthStats.completed}</div>
          <div className="text-[10px] text-green-400 mt-0 sm:mt-1 flex items-center gap-1">
             <CheckCircle2 size={10}/> Hoàn thành
          </div>
        </div>
        <div className="bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-orange-100 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-2">
          <div className="flex flex-col items-start sm:items-center">
             <div className="text-blue-600 text-xs font-semibold uppercase mb-0 sm:mb-1">Tỷ lệ</div>
             <div className="text-2xl lg:text-3xl font-bold text-blue-600">{monthStats.completionRate}%</div>
          </div>
          <div className="w-24 sm:w-full bg-gray-100 h-1.5 rounded-full mt-0 sm:mt-2 overflow-hidden">
             <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${monthStats.completionRate}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-[300px]">
        {/* Chart Area */}
        <div className="flex-1 bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-orange-100 flex flex-col items-center justify-center relative min-h-[250px]">
          <h3 className="text-sm font-bold text-gray-700 absolute top-4 left-4 flex items-center gap-2">
            <PieChart size={16} className="text-orange-500"/> Phân bổ theo Thẻ
          </h3>
          
          {monthStats.total === 0 ? (
            <div className="text-center text-gray-400 flex flex-col items-center">
               <AlertCircle size={48} className="mb-2 opacity-50"/>
               <p>Chưa có dữ liệu trong tháng này.</p>
            </div>
          ) : (
            <div className="flex items-center gap-8 flex-wrap justify-center mt-6 md:mt-0">
              {/* Donut Chart */}
              <div 
                className="w-40 h-40 lg:w-48 lg:h-48 rounded-full shadow-inner relative transition-all hover:scale-105 duration-300"
                style={{ background: gradientString }}
              >
                {/* Inner White Circle to make it a Donut */}
                <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col shadow-sm">
                   <span className="text-2xl lg:text-3xl font-bold text-gray-700">{monthStats.total}</span>
                   <span className="text-[10px] text-gray-400 uppercase">Task</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2 min-w-[150px]">
                 {monthStats.chartData.map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${item.tailwindDot}`}></span>
                        <span className="text-gray-700 font-medium group-hover:text-orange-600 transition">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-gray-800">{item.count}</span>
                         <span className="text-xs text-gray-400 w-8 text-right">{Math.round(item.percentage)}%</span>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Monthly Goals / Insights */}
        <div className="md:w-1/3 bg-white p-4 lg:p-5 rounded-xl shadow-sm border border-orange-100 flex flex-col">
           <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
             <Target size={16} className="text-red-500"/> Mục tiêu & Xu hướng
           </h3>
           
           <div className="space-y-4 flex-1">
              <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                 <div className="text-xs text-red-600 font-bold mb-1">Công việc chưa xong</div>
                 <div className="text-xl font-bold text-red-700 flex items-center gap-2">
                    {monthStats.pending} <span className="text-xs font-normal text-red-500">việc cần xử lý</span>
                 </div>
              </div>

              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                 <div className="text-xs text-orange-600 font-bold mb-1">Thẻ chiếm đa số</div>
                 <div className="text-lg font-bold text-orange-800 truncate">
                    {monthStats.chartData.length > 0 ? monthStats.chartData[0].name : "N/A"}
                 </div>
                 <div className="text-xs text-orange-500 mt-1">
                    Chiếm {monthStats.chartData.length > 0 ? Math.round(monthStats.chartData[0].percentage) : 0}% quỹ thời gian
                 </div>
              </div>
           </div>
           
           <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500 italic">
                "{monthStats.completionRate > 80 ? 'Bạn đang làm rất tốt! Hãy duy trì phong độ.' : 'Cố gắng hoàn thành thêm các việc tồn đọng nhé!'}"
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(StatsView);