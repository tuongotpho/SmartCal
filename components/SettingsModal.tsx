
import React, { useState, useEffect, useRef } from 'react';
import { TelegramConfig, Tag, COLOR_PALETTES } from '../types';
import { X, Save, Key, MessageSquare, RefreshCw, Clock, Tag as TagIcon, Plus, Trash2, ChevronDown, Sparkles } from 'lucide-react';
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
  showToast
}) => {
  const [config, setConfig] = useState<TelegramConfig>(telegramConfig);
  const [currentTags, setCurrentTags] = useState<Tag[]>(tags);
  const [activeTab, setActiveTab] = useState<'general' | 'tags'>('general');
  const [newTagName, setNewTagName] = useState('');
  
  // Gemini Key State
  const [geminiKey, setGeminiKey] = useState('');
  
  // Custom Dropdown State
  const [newTagColorKey, setNewTagColorKey] = useState('Gray');
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State cho Modal xác nhận xóa
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  useEffect(() => {
    setConfig(telegramConfig);
    setCurrentTags(tags);
    // Load Gemini Key từ LocalStorage khi mở modal
    setGeminiKey(localStorage.getItem('gemini_api_key') || '');
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

  // Helper để hiển thị masked key
  const formatKeyDisplay = (key: string) => {
    if (!key) return '';
    if (key.length < 8) return '********';
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };

  if (!isOpen) return null;

  return (
    // Thay bg-black bằng bg-orange-950/30 để loại bỏ màu đen kỵ Hỏa
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-orange-950/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-orange-100">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Key size={20} /> Cài đặt Hệ thống
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'general' ? 'text-orange-600 border-b-2 border-orange-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Cấu hình chung
          </button>
          <button 
             onClick={() => setActiveTab('tags')}
             className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'tags' ? 'text-orange-600 border-b-2 border-orange-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Quản lý Thẻ (Tags)
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* Gemini Config */}
              <div className="space-y-3">
                 <h3 className="text-gray-800 font-semibold text-sm flex items-center gap-2 border-b pb-2">
                  <Sparkles size={16} className="text-orange-500" /> Cấu hình Gemini AI
                </h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">API Key (Google AI Studio)</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="Nhập API Key để kích hoạt AI"
                      style={{ colorScheme: 'light' }}
                      className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none pr-10"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Key được lưu trên trình duyệt của bạn (LocalStorage). Lấy key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-600 underline">aistudio.google.com</a>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-gray-800 font-semibold text-sm flex items-center gap-2 border-b pb-2">
                  <MessageSquare size={16} className="text-blue-500" /> Cấu hình Telegram Bot
                </h3>
                
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
                    <input
                      type="text"
                      value={config.botToken}
                      onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                      placeholder="123456789:ABCdef..."
                      style={{ colorScheme: 'light' }}
                      className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Lấy từ @BotFather trên Telegram.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Chat ID</label>
                    <input
                      type="text"
                      value={config.chatId}
                      onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                      placeholder="-987654321 hoặc ID cá nhân"
                      style={{ colorScheme: 'light' }}
                      className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">ID của nhóm hoặc cá nhân nhận thông báo.</p>
                  </div>
                </div>

                {/* Manual Sync Button inside Settings */}
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-orange-800">Đồng bộ thủ công</span>
                    {lastSyncTime && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> {lastSyncTime}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={onManualSync}
                    disabled={isSyncing || !config.botToken}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2
                      ${isSyncing || !config.botToken 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-white border border-orange-300 text-orange-700 hover:bg-orange-100'}
                    `}
                  >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {config.botToken ? "Quét tin nhắn Telegram ngay" : "Vui lòng nhập Token trước"}
                  </button>
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    Hệ thống tự động quét tin nhắn mỗi phút.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              <h3 className="text-gray-800 font-semibold text-sm flex items-center gap-2 pb-2">
                <TagIcon size={16} className="text-orange-500" /> Danh sách Thẻ phân loại
              </h3>
              
              {/* Add New Tag */}
              <div className="flex gap-2 items-end bg-gray-50 p-3 rounded border border-gray-200">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Tên thẻ mới</label>
                  <input 
                    type="text" 
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="VD: Dự án A" 
                    style={{ colorScheme: 'light' }}
                    className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                
                {/* Custom Color Dropdown để tránh nền đen */}
                <div className="w-1/3 relative" ref={dropdownRef}>
                  <label className="text-xs text-gray-500 mb-1 block">Màu sắc</label>
                  <button
                    onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                    className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none bg-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                       <div className={`w-3 h-3 rounded-full ${COLOR_PALETTES[newTagColorKey]?.dot}`}></div>
                       <span className="truncate">{COLOR_PALETTES[newTagColorKey]?.label}</span>
                    </div>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>

                  {isColorDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.keys(COLOR_PALETTES).map(key => (
                        <div 
                          key={key} 
                          onClick={() => {
                            setNewTagColorKey(key);
                            setIsColorDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 p-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-700"
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
                  className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded transition"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Tag List */}
              <div className="flex-1 overflow-y-auto space-y-2 border rounded p-2 custom-scrollbar max-h-[300px]">
                {currentTags.map((tag, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white border rounded shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-4 h-4 rounded-full ${tag.dot} shadow-sm border border-white`}></span>
                      <span className="font-semibold text-sm text-gray-700">{tag.name}</span>
                    </div>
                    {/* Don't allow deleting 'Khác' to prevent errors */}
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
                {currentTags.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Chưa có thẻ nào.</p>}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end flex-shrink-0">
          <button
            onClick={() => {
              onSaveConfig(config);
              onSaveTags(currentTags);
              // Lưu Gemini Key
              if (geminiKey) {
                localStorage.setItem('gemini_api_key', geminiKey);
                showToast("Đã lưu cấu hình & API Key!", "success");
              } else {
                localStorage.removeItem('gemini_api_key');
                 showToast("Đã lưu cấu hình (Không có API Key)", "info");
              }
              onClose();
            }}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition shadow-md text-sm font-medium"
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
