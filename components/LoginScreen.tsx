
import React, { useState } from 'react';
import { Flame, CheckCircle2, WifiOff, AlertTriangle } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface LoginScreenProps {
  onBypassAuth: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onBypassAuth }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login Error:", err);
      let msg = "Đăng nhập thất bại.";
      if (err.code === 'auth/popup-closed-by-user') msg = "Bạn đã đóng cửa sổ đăng nhập.";
      else if (err.code === 'auth/operation-not-supported-in-this-environment') msg = "Môi trường không hỗ trợ đăng nhập Google. Vui lòng dùng chế độ Offline.";
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff7ed] dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-orange-100 dark:border-gray-800 p-8 text-center animate-in fade-in zoom-in duration-500">
        
        {/* Logo Animation */}
        <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 transform hover:rotate-6 transition-transform duration-300">
           <Flame size={48} className="text-white" fill="currentColor" />
        </div>

        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          SmartCal <span className="text-orange-600">Pro</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Quản lý lịch trình & công việc thông minh với sự hỗ trợ của AI.
        </p>

        {/* Features List */}
        <div className="text-left space-y-3 mb-8 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
           <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>Đồng bộ dữ liệu trên mọi thiết bị</span>
           </div>
           <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>Tạo công việc bằng giọng nói (AI)</span>
           </div>
           <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>Tích hợp Telegram Bot & Báo cáo</span>
           </div>
           <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>Bảo mật dữ liệu cá nhân</span>
           </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs text-left rounded-lg border border-red-100 dark:border-red-800 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            )}
            Đăng nhập bằng Google
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
            <span className="flex-shrink-0 mx-2 text-gray-400 text-xs">hoặc</span>
            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
          </div>

          <button
            onClick={onBypassAuth}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium py-3 px-4 rounded-xl transition-all active:scale-95 text-sm"
          >
            <WifiOff size={16} />
            Dùng thử ngay (Chế độ Offline)
          </button>
        </div>

        <p className="mt-6 text-[10px] text-gray-400 dark:text-gray-500">
          * Chế độ Offline sẽ lưu dữ liệu trên trình duyệt của bạn. Dữ liệu có thể mất nếu xóa cache.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
