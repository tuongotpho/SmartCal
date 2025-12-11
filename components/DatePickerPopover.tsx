
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, setMonth, setYear, addYears, startOfYear } from 'date-fns';

interface DatePickerPopoverProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

type PickerMode = 'month' | 'year';

const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({ currentDate, onDateSelect, onClose }) => {
  const [viewDate, setViewDate] = useState(currentDate);
  const [mode, setMode] = useState<PickerMode>('month');

  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(viewDate, monthIndex);
    onDateSelect(newDate);
    onClose();
  };

  const handleYearSelect = (year: number) => {
    const newDate = setYear(viewDate, year);
    setViewDate(newDate);
    setMode('month'); // Quay lại chọn tháng sau khi chọn năm
  };

  const changeYearView = (delta: number) => {
    setViewDate(addYears(viewDate, delta));
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-3 gap-2">
      {months.map((month, idx) => {
        const isSelected = idx === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear();
        return (
          <button
            key={month}
            onClick={() => handleMonthSelect(idx)}
            className={`p-2 rounded-lg text-xs font-semibold transition-colors ${
              isSelected 
                ? 'bg-orange-500 text-white shadow-md' 
                : 'bg-orange-50 text-gray-700 hover:bg-orange-100 hover:text-orange-600'
            }`}
          >
            {month}
          </button>
        );
      })}
    </div>
  );

  const renderYearView = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = currentYear - 5;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    return (
      <div className="grid grid-cols-3 gap-2">
        {years.map((year) => {
          const isSelected = year === currentDate.getFullYear();
          return (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`p-2 rounded-lg text-sm font-bold transition-colors ${
                isSelected 
                  ? 'bg-orange-500 text-white shadow-md' 
                  : 'bg-orange-50 text-gray-700 hover:bg-orange-100 hover:text-orange-600'
              }`}
            >
              {year}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-xl border border-orange-100 z-50 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-orange-50 bg-gradient-to-r from-orange-50 to-white rounded-t-xl">
        <button 
          onClick={() => changeYearView(mode === 'month' ? -1 : -12)}
          className="p-1 hover:bg-white rounded-full text-orange-600 transition shadow-sm"
        >
          <ChevronLeft size={16} />
        </button>
        
        <button 
          onClick={() => setMode(mode === 'month' ? 'year' : 'month')}
          className="text-sm font-bold text-gray-800 hover:text-orange-600 transition flex items-center gap-1 px-2 py-1 rounded hover:bg-white/50"
        >
          {mode === 'month' ? `Năm ${viewDate.getFullYear()}` : 'Chọn Năm'} <Calendar size={12} />
        </button>

        <button 
          onClick={() => changeYearView(mode === 'month' ? 1 : 12)}
          className="p-1 hover:bg-white rounded-full text-orange-600 transition shadow-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {mode === 'month' ? renderMonthView() : renderYearView()}
      </div>

      {/* Footer (Optional: Go to Today) */}
      <div className="p-2 border-t border-orange-50 text-center">
        <button 
          onClick={() => { onDateSelect(new Date()); onClose(); }}
          className="text-xs text-orange-600 font-semibold hover:underline"
        >
          Quay về Hôm nay
        </button>
      </div>
    </div>
  );
};

export default DatePickerPopover;
