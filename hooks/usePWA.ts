import { useState, useEffect, useCallback } from 'react';

export function usePWA(showToast: (msg: string, type: "success" | "info" | "warning" | "error") => void) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault(); // Prevent the mini-infobar from appearing on mobile
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = useCallback(async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            showToast("Đang cài đặt ứng dụng...", "success");
        }
    }, [deferredPrompt, showToast]);

    return {
        deferredPrompt,
        handleInstallClick,
    };
}
