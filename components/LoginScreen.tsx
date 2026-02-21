
import React, { useState } from 'react';
import { CheckCircle2, WifiOff, AlertTriangle, Mail, Lock, X, LogIn, ExternalLink, Key } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signInWithGoogleToken, isTauri } from '../services/firebase';

interface LoginScreenProps {
  onBypassAuth: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onBypassAuth }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Secret Login State
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Tauri Token Login State
  const [showTokenLogin, setShowTokenLogin] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  const isDesktopApp = isTauri();

  const [showCopyToken, setShowCopyToken] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result: any = await signInWithGoogle();

      // Nếu là luồng xác thực từ desktop app, API trả về oauth_token thuần
      if (result && result.type === 'oauth_token') {
        setShowCopyToken(result.token);
        setIsLoading(false);
        return; // Dừng tại đây, không cho load vào màn hình chính
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/tauri-external') {
        // Tauri: đã mở browser, hiện form paste token
        setShowTokenLogin(true);
        setError(null);
      } else {
        let msg = "Đăng nhập thất bại.";
        if (err.code === 'auth/popup-closed-by-user') msg = "Bạn đã đóng cửa sổ đăng nhập.";
        else if (err.code === 'auth/operation-not-supported-in-this-environment') msg = "Môi trường không hỗ trợ đăng nhập Google. Vui lòng dùng chế độ Offline.";
        else if (err.message) msg = err.message;
        setError(msg);
      }
    } finally {
      if (!showCopyToken) setIsLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!authToken.trim()) return;
    setTokenLoading(true);
    setError(null);
    try {
      await signInWithGoogleToken(authToken.trim());
      setShowTokenLogin(false);
      setAuthToken("");
    } catch (err: any) {
      setError("Token không hợp lệ hoặc đã hết hạn. Hãy thử lại.");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleSecretLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError("Tài khoản hoặc mật khẩu không đúng.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff7ed] dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-orange-100 dark:border-gray-800 p-8 text-center animate-in fade-in zoom-in duration-500 relative">

        {/* Logo Animation */}
        <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 transform hover:rotate-6 transition-transform duration-300 overflow-hidden p-2 border border-orange-100 dark:border-gray-700">
          <img
            src="https://raw.githubusercontent.com/thanhlv87/pic/refs/heads/main/august2.png"
            alt="SmartCal Logo"
            className="w-full h-full object-contain"
          />
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
            {/* THE SECRET TRIGGER: No cursor pointer, no hover effect */}
            <span
              onClick={() => setShowSecretLogin(true)}
              className="cursor-default select-none"
            >
              Đồng bộ dữ liệu trên mọi thiết bị
            </span>
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
            ) : isDesktopApp ? (
              <ExternalLink size={20} className="text-blue-500" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            )}
            {isDesktopApp ? 'Đăng nhập qua Trình duyệt' : 'Đăng nhập bằng Google'}
          </button>

          {/* Token paste section for Tauri */}
          {showTokenLogin && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3 animate-in fade-in duration-200">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-left">
                <strong>Bước 1:</strong> Đăng nhập Google trên trình duyệt vừa mở<br />
                <strong>Bước 2:</strong> Bấm nút <strong>"📋 Copy Token"</strong> trên web<br />
                <strong>Bước 3:</strong> Dán token vào ô bên dưới
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Dán token ở đây..."
                  className="flex-1 border border-blue-300 dark:border-blue-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleTokenLogin}
                  disabled={tokenLoading || !authToken.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  {tokenLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Key size={14} />
                  )}
                  Xác nhận
                </button>
              </div>
            </div>
          )}

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

        {showCopyToken && (
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl animate-in fade-in duration-200">
            <div className="w-full max-w-xs p-4 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                Đăng nhập thành công! 🎉
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Bấm nút bên dưới để copy token, sau đó dán vào ứng dụng Desktop SmartCal.
              </p>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(showCopyToken);
                    alert("Đã copy thành công!");
                  } catch (e) {
                    const el = document.createElement("textarea");
                    el.value = showCopyToken;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand("copy");
                    document.body.removeChild(el);
                    alert("Đã copy thành công!");
                  }
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
              >
                📋 Copy Token
              </button>
            </div>
          </div>
        )}

        {/* Secret Login Modal */}
        {showSecretLogin && (
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl animate-in fade-in duration-200">
            <button
              onClick={() => { setShowSecretLogin(false); setError(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
            <div className="w-full max-w-xs p-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Admin Login</h2>
              <form onSubmit={handleSecretLogin} className="space-y-4">
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <LogIn size={18} />}
                  Đăng nhập
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
