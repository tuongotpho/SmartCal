
import React, { useState, useEffect, useRef } from 'react';
import { TelegramConfig, Tag, COLOR_PALETTES, AppTheme } from '../types';
import { X, Save, MessageSquare, RefreshCw, Clock, Tag as TagIcon, Plus, Trash2, ChevronDown, Palette } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { ToastType } from './Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramConfig: TelegramConfig;
  tags: Tag[];
  onSaveConfig: (config: TelegramConfig) => void;
  onSaveTags: (tags: Tag[]) => void;
  onManualSync: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
  showToast: (message: string, type: ToastType) => void;
  
  // Theme Props
  currentTheme?: string;
  setCurrentTheme?: (theme: string) => void;
  themes?: AppTheme[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  telegramConfig, 
  tags,
  onSaveConfig,
  onSaveTags,
  onManualSync,
  isSyncing,
  lastSyncTime,
  showToast,
  currentTheme,
  setCurrentTheme,
  themes = []
}) => {
  const [config, setConfig] = useState<TelegramConfig>(telegramConfig);
  const [currentTags, setCurrentTags] = useState<Tag[]>(tags);
  const [activeTab, setActiveTab] = useState<'general' | 'tags'>('general');
  const [newTagName, setNewTagName] = useState('');
  
  // Custom Dropdown State
  const [newTagColorKey, setNewTagColorKey] = useState('Gray');
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State cho Modal xác nhận xóa
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  useEffect(() => {
    setConfig(telegramConfig);
    setCurrentTags(tags);
  }, [telegramConfig, tags, isOpen]);

  // Click outside to close custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const palette = COLOR_PALETTES[newTagColorKey] || COLOR_PALETTES.Gray;
    
    // Check duplicate
    if (currentTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      showToast("Tên thẻ đã tồn tại!", "warning");
      return;
    }

    const newTag: Tag = {
      name: newTagName.trim(),
      ...palette
    };

    setCurrentTags([...currentTags, newTag]);
    setNewTagName('');
  };

  const handleDeleteTagRequest = (tagName: string) => {
    setTagToDelete(tagName);
  };

  const confirmDeleteTag = () => {
    if (tagToDelete) {
      setCurrentTags(currentTags.filter(t => t.name !== tagToDelete));
      setTagToDelete(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-primary-100 dark:border-gray-700">
        <div className="bg-gradient-to-r from-primary-500 to-primary-700 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Cài đặt Hệ thống
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'general' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Cấu hình chung
          </button>
          <button 
             onClick={() => setActiveTab('tags')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'tags' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Quản lý Thẻ (Tags)
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              
              {/* Theme Selection */}
              {themes && setCurrentTheme && (
                 <div className="space-y-3">
                   <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-sm flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                    <Palette size={16} className="text-primary-500" /> Giao diện & Màu sắc
                   </h3>
                   <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {themes.map(t => (
                        <button
                          key={t.name}
                          onClick={() => setCurrentTheme(t.name)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${currentTheme === t.name ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                           <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: `rgb(${t.colors[500]})` }}></div>
                           <span className="text-[10px] text-gray-600 dark:text-gray-300 truncate w-full text-center">{t.label}</span>
                        </button>
                      ))}
                   </div>
                 </div>
              )}

              <div className="space-y-4">
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-sm flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                  <MessageSquare size={16} className="text-blue-500" /> Cấu hình Telegram Bot
                </h3>
                
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bot Token</label>
                    <input
                      type="text"
                      value={config.botToken}
                      onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                      placeholder="123456789:ABCdef..."
                      className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Chat ID</label>
                    <input
                      type="text"
                      value={config.chatId}
                      onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                      placeholder="-987654321 hoặc ID cá nhân"
                      className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Manual Sync Button inside Settings */}
                <div className="bg-primary-50 dark:bg-primary-900/10 p-3 rounded-lg border border-primary-100 dark:border-primary-900/30 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-primary-800 dark:text-primary-300">Đồng bộ thủ công</span>
                    {lastSyncTime && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {lastSyncTime}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={onManualSync}
                    disabled={isSyncing || !config.botToken}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2
                      ${isSyncing || !config.botToken 
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                        : 'bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30'}
                    `}
                  >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {config.botToken ? "Quét tin nhắn Telegram ngay" : "Vui lòng nhập Token trước"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-sm flex items-center gap-2 pb-2">
                <TagIcon size={16} className="text-primary-500" /> Danh sách Thẻ phân loại
              </h3>
              
              {/* Add New Tag */}
              <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-300 mb-1 block">Tên thẻ mới</label>
                  <input 
                    type="text" 
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="VD: Dự án A" 
                    className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                {/* Custom Color Dropdown */}
                <div className="w-1/3 relative" ref={dropdownRef}>
                  <label className="text-xs text-gray-500 dark:text-gray-300 mb-1 block">Màu sắc</label>
                  <button
                    onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                    className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                       <div className={`w-3 h-3 rounded-full ${COLOR_PALETTES[newTagColorKey]?.dot}`}></div>
                       <span className="truncate">{COLOR_PALETTES[newTagColorKey]?.label}</span>
                    </div>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>

                  {isColorDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.keys(COLOR_PALETTES).map(key => (
                        <div 
                          key={key} 
                          onClick={() => {
                            setNewTagColorKey(key);
                            setIsColorDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 p-2 hover:bg-primary-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                        >
                           <div className={`w-3 h-3 rounded-full ${COLOR_PALETTES[key].dot}`}></div>
                           <span>{COLOR_PALETTES[key].label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleAddTag}
                  className="bg-primary-500 hover:bg-primary-600 text-white p-2 rounded transition"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Tag List */}
              <div className="flex-1 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded p-2 custom-scrollbar max-h-[300px]">
                {currentTags.map((tag, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-4 h-4 rounded-full ${tag.dot} shadow-sm border border-white dark:border-gray-600`}></span>
                      <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{tag.name}</span>
                    </div>
                    {tag.name !== 'Khác' && (
                      <button 
                        onClick={() => handleDeleteTagRequest(tag.name)}
                        className="text-gray-400 hover:text-red-500 p-1 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end flex-shrink-0">
          <button
            onClick={() => {
              onSaveConfig(config);
              onSaveTags(currentTags);
              showToast("Đã lưu cấu hình", "success");
              onClose();
            }}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-md text-sm font-medium"
          >
            <Save size={16} /> Lưu cấu hình
          </button>
        </div>
      </div>
      
      {/* Modal Xác nhận xóa Thẻ */}
      <ConfirmModal 
        isOpen={!!tagToDelete}
        onClose={() => setTagToDelete(null)}
        onConfirm={confirmDeleteTag}
        title="Xóa Thẻ phân loại"
        message={`Bạn có chắc muốn xóa thẻ "${tagToDelete}"? Các công việc cũ sẽ giữ nguyên tên thẻ nhưng sẽ mất màu sắc đặc trưng.`}
      />
    </div>
  );
};

export default SettingsModal;
