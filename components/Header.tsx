
import React, { useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  X, 
  Sun, 
  Moon, 
  Settings, 
  LogOut, 
  User, 
  Flame 
} from 'lucide-react';
import { format } from 'date-fns';
import DatePickerPopover from './DatePickerPopover';
import { ToastType } from './Toast';

interface HeaderProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  getHeaderText: string;
  onPrev: () => void;
  onNext: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  user: any;
  isOfflineMode: boolean;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  onLogout: () => void;
  datePickerRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

const Header: React.FC<HeaderProps> = ({
  currentDate,
  setCurrentDate,
  getHeaderText,
  onPrev,
  onNext,
  searchQuery,
  setSearchQuery,
  isSearchActive,
  setIsSearchActive,
  isDatePickerOpen,
  setIsDatePickerOpen,
  user,
  isOfflineMode,
  isDarkMode,
  toggleTheme,
  setIsSettingsOpen,
  onLogout,
  datePickerRef,
  searchInputRef
}) => {
  return (
    <div className="bg-gradient-to-r from-orange-500/95 to-red-600/95 backdrop-blur-md text-white p-3 shadow-md z-30 flex-shrink-0 sticky top-0">
      <div className="flex justify-between items-center px-1 lg:px-4">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm shadow-inner hidden sm:block">
            <Flame size={20} className="text-yellow-200" fill="currentColor" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">SmartCal <span className="hidden sm:inline-block text-xs font-light opacity-80 bg-white/10 px-1 rounded">PRO</span></h1>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
           <button onClick={onPrev} className="hover:bg-white/20 p-1.5 rounded-full transition active:scale-90"><ChevronLeft size={20} /></button>
           
           {/* Date Picker & Search Trigger */}
           <div className="flex items-center gap-1">
             {/* Search Input */}
              <div className={`transition-all duration-300 overflow-hidden flex items-center ${isSearchActive ? 'w-32 sm:w-48 bg-white/20 rounded-md' : 'w-0'}`}>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => !searchQuery && setIsSearchActive(false)}
                    placeholder="Tìm kiếm..."
                    className="w-full bg-transparent border-none outline-none text-white text-xs px-2 py-1 placeholder-white/50"
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="p-1 hover:text-red-200"><X size={12}/></button>
                  )}
              </div>

              {!isSearchActive && (
                  <button onClick={() => setIsSearchActive(true)} className="p-1.5 hover:bg-white/20 rounded-full transition active:scale-95">
                      <Search size={18} />
                  </button>
              )}

             <div className="relative" ref={datePickerRef}>
                <button 
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="min-w-[80px] sm:min-w-[140px] flex items-center justify-center gap-1 text-sm sm:text-base font-bold bg-white/10 px-2 py-1 rounded-md border border-white/20 shadow-sm backdrop-blur-sm hover:bg-white/20 transition active:scale-95 cursor-pointer"
                >
                  <span className="hidden sm:inline">{getHeaderText}</span>
                  <span className="sm:hidden">{format(currentDate, 'dd/MM')}</span>
                   <ChevronDown size={14} className="opacity-70" />
                </button>
                
                {isDatePickerOpen && (
                  <DatePickerPopover 
                    currentDate={currentDate}
                    onDateSelect={(date) => {
                      setCurrentDate(date);
                      setIsDatePickerOpen(false);
                    }}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                )}
              </div>
           </div>

           <button onClick={onNext} className="hover:bg-white/20 p-1.5 rounded-full transition active:scale-90"><ChevronRight size={20} /></button>
        </div>

        <div className="flex gap-2 sm:gap-3 items-center">
           {/* User Info / Logout (Desktop) */}
           <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-white/20 pr-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-white/50" />
              ) : (
                <User size={20} />
              )}
              <span className="text-xs font-medium max-w-[80px] truncate">
                {user?.displayName || (isOfflineMode ? 'Offline' : 'User')}
              </span>
           </div>

          {/* Dark Mode Toggle */}
           <button 
              onClick={toggleTheme} 
              className="hover:bg-white/20 p-2 rounded-full transition text-xs font-semibold backdrop-blur-sm active:scale-95"
              title="Chuyển chế độ Sáng/Tối"
           >
             {isDarkMode ? <Sun size={20} className="text-yellow-300" /> : <Moon size={20} className="text-white" />}
           </button>

           {/* Settings Button */}
          <button onClick={() => setIsSettingsOpen(true)} className="hidden lg:flex items-center gap-1 hover:bg-white/20 px-2 py-1.5 rounded-md transition text-xs font-semibold backdrop-blur-sm active:scale-95">
            <Settings size={20} /> <span className="hidden sm:inline">Cài đặt</span>
          </button>
          
          {/* Logout Button */}
          <button 
            onClick={onLogout} 
            className="hover:bg-white/20 p-2 rounded-full transition text-xs font-semibold backdrop-blur-sm active:scale-95" 
            title={isOfflineMode ? "Thoát chế độ Offline" : "Đăng xuất"}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Header);
