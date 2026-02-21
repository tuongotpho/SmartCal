import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { CheckCircle2, Copy, Monitor } from 'lucide-react';

/**
 * DesktopAuthHelper: Hiển thị khi web app được mở từ Tauri desktop
 * Cho phép user copy Google auth token để paste vào desktop app
 */
const DesktopAuthHelper: React.FC = () => {
    const [token, setToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Chỉ hiện khi URL có ?desktop_auth=true VÀ user đã đăng nhập
        const params = new URLSearchParams(window.location.search);
        if (params.get('desktop_auth') !== 'true') return;

        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    // Lấy Google ID token từ user hiện tại
                    const idToken = await user.getIdToken(true);
                    setToken(idToken);
                    setShow(true);
                } catch (err) {
                    console.error("Failed to get token:", err);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    if (!show || !token) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = token;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-orange-200 dark:border-gray-700">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                    <Monitor size={28} className="text-green-600" />
                </div>

                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    Đăng nhập thành công! 🎉
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Bấm nút bên dưới để copy token, sau đó dán vào ứng dụng Desktop SmartCal.
                </p>

                <button
                    onClick={handleCopy}
                    className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm ${copied
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                >
                    {copied ? (
                        <>
                            <CheckCircle2 size={18} />
                            Đã copy! Quay lại Desktop App để dán
                        </>
                    ) : (
                        <>
                            <Copy size={18} />
                            📋 Copy Token
                        </>
                    )}
                </button>

                <button
                    onClick={() => setShow(false)}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    Đóng và tiếp tục dùng Web
                </button>
            </div>
        </div>
    );
};

export default DesktopAuthHelper;
