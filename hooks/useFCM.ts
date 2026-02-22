import { useState, useEffect } from 'react';
import { checkFCMSupport, initializeFCM, onForegroundMessage, FCMConfig } from '../services/fcmService';

export function useFCM(
    user: any,
    isOfflineMode: boolean,
    showToast: (msg: string, type: "success" | "info" | "warning" | "error") => void,
    addNotification: (title: string, message: string, type: "info" | "success" | "warning" | "error", withSound: boolean) => void
) {
    const [fcmConfig, setFcmConfig] = useState<FCMConfig>({ enabled: false, token: null });

    // 1. Khởi tạo FCM khi có user
    useEffect(() => {
        if (!user || isOfflineMode) return;

        const initFCM = async () => {
            const supported = await checkFCMSupport();
            if (!supported) {
                console.log("FCM không được hỗ trợ");
                return;
            }

            const result = await initializeFCM(user.uid);
            setFcmConfig(result);

            if (result.enabled) {
                showToast("Đã bật thông báo Push!", "success");
            }
        };

        initFCM();
    }, [user, isOfflineMode, showToast]);

    // 2. Lắng nghe tin nhắn foreground
    useEffect(() => {
        if (!fcmConfig.enabled) return;

        const unsubscribe = onForegroundMessage((payload) => {
            console.log("Received FCM message:", payload);

            if (payload.notification) {
                const title = payload.notification.title || "Thông báo mới";
                const body = payload.notification.body || "";

                showToast(`${title}: ${body}`, 'info');
                addNotification(title, body, 'info', true);
            }
        });

        return () => unsubscribe();
    }, [fcmConfig.enabled, showToast, addNotification]);

    return {
        fcmConfig,
        setFcmConfig,
    };
}
