
// Sử dụng firebase compat để tương thích với project hiện tại
import firebase from 'firebase/compat/app';
import 'firebase/compat/messaging';
import 'firebase/compat/firestore';

// Firebase config - same as main app
const firebaseConfig = {
  apiKey: "AIzaSyDqySsLO1mHWhTP9JDJ81OpF0XwDDbFHFM",
  authDomain: "nhacviec-87.firebaseapp.com",
  projectId: "nhacviec-87",
  storageBucket: "nhacviec-87.firebasestorage.app",
  messagingSenderId: "599507356600",
  appId: "1:599507356600:web:6e7244776ae2d828945d4d",
  measurementId: "G-5PWJQNSEFF"
};

// Initialize Firebase app for FCM (sử dụng app hiện có nếu đã tồn tại)
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

// VAPID Key - Cần tạo tại Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// Thay thế bằng VAPID key thực tế của bạn
const VAPID_KEY = "BKpLCibJfSV1Q3mPdZYkn07bh6E2gkcadkoJR1DDyhudRWN2q43XFya32-r3HaTw_ha8rb5j_Oqk467IaGB8JdI";

export interface FCMConfig {
  enabled: boolean;
  token: string | null;
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ FCM không
 */
export const checkFCMSupport = (): boolean => {
  try {
    // FCM yêu cầu Service Worker và Notifications API
    return 'serviceWorker' in navigator && 'Notification' in window;
  } catch {
    return false;
  }
};

/**
 * Request permission và lấy FCM token
 */
export const requestFCMPermission = async (): Promise<string | null> => {
  try {
    // Kiểm tra hỗ trợ
    if (!checkFCMSupport()) {
      console.warn("FCM không được hỗ trợ trên trình duyệt này");
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log("Người dùng từ chối quyền thông báo");
      return null;
    }

    // Get messaging instance
    const messaging = firebase.messaging(app);

    // Get FCM token
    const currentToken = await messaging.getToken({ 
      vapidKey: VAPID_KEY 
    });

    if (currentToken) {
      console.log("FCM Token:", currentToken);
      return currentToken;
    } else {
      console.log("Không thể lấy FCM token");
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi request FCM permission:", error);
    return null;
  }
};

/**
 * Lưu FCM token lên Firestore cho user
 */
export const saveFCMTokenToFirestore = async (userId: string, token: string): Promise<boolean> => {
  try {
    await db.collection('users').doc(userId).collection('config').doc('fcm').set({
      token,
      updatedAt: new Date().toISOString(),
      platform: getPlatform()
    }, { merge: true });
    console.log("Đã lưu FCM token lên Firestore");
    return true;
  } catch (error) {
    console.error("Lỗi khi lưu FCM token:", error);
    return false;
  }
};

/**
 * Xóa FCM token khỏi Firestore
 */
export const removeFCMTokenFromFirestore = async (userId: string): Promise<boolean> => {
  try {
    await db.collection('users').doc(userId).collection('config').doc('fcm').delete();
    console.log("Đã xóa FCM token khỏi Firestore");
    return true;
  } catch (error) {
    console.error("Lỗi khi xóa FCM token:", error);
    return false;
  }
};

/**
 * Hủy đăng ký FCM token
 */
export const unregisterFCMToken = async (): Promise<boolean> => {
  try {
    const messaging = firebase.messaging(app);
    await messaging.deleteToken();
    console.log("Đã hủy đăng ký FCM token");
    return true;
  } catch (error) {
    console.error("Lỗi khi hủy đăng ký FCM:", error);
    return false;
  }
};

/**
 * Lắng nghe foreground messages (khi app đang mở)
 */
export const onForegroundMessage = (callback: (payload: any) => void): (() => void) => {
  try {
    const messaging = firebase.messaging(app);
    return messaging.onMessage((payload: any) => {
      console.log("Foreground message:", payload);
      callback(payload);
    });
  } catch (error) {
    console.error("Lỗi khi lắng nghe foreground message:", error);
    return () => {};
  }
};

/**
 * Lấy platform info
 */
const getPlatform = (): string => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  return 'web';
};

/**
 * Khởi tạo FCM cho user
 */
export const initializeFCM = async (userId: string): Promise<FCMConfig> => {
  try {
    if (!checkFCMSupport()) {
      return { enabled: false, token: null };
    }

    const token = await requestFCMPermission();
    if (token) {
      await saveFCMTokenToFirestore(userId, token);
      return { enabled: true, token };
    }
    
    return { enabled: false, token: null };
  } catch (error) {
    console.error("Lỗi khởi tạo FCM:", error);
    return { enabled: false, token: null };
  }
};

/**
 * Tắt FCM cho user
 */
export const disableFCM = async (userId: string): Promise<boolean> => {
  try {
    await unregisterFCMToken();
    await removeFCMTokenFromFirestore(userId);
    return true;
  } catch (error) {
    console.error("Lỗi tắt FCM:", error);
    return false;
  }
};
