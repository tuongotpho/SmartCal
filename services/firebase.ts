import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import { Task, RecurringType, Tag, DEFAULT_TASK_TAGS, Subtask, TelegramConfig } from "../types";

// Cấu hình Firebase từ người dùng cung cấp
const firebaseConfig = {
  apiKey: "AIzaSyDqySsLO1mHWhTP9JDJ81OpF0XwDDbFHFM",
  authDomain: "nhacviec-87.firebaseapp.com",
  projectId: "nhacviec-87",
  storageBucket: "nhacviec-87.firebasestorage.app",
  messagingSenderId: "599507356600",
  appId: "1:599507356600:web:6e7244776ae2d828945d4d",
  measurementId: "G-5PWJQNSEFF"
};

// Khởi tạo Firebase
// Sử dụng check apps.length để tránh lỗi khởi tạo lại khi hot-reload
const app = !firebase.apps.length
  ? firebase.initializeApp(firebaseConfig)
  : firebase.app();

// Initialize Firestore (Compat Mode)
const db = firebase.firestore(app);
export const auth = firebase.auth(app);
export const googleProvider = new firebase.auth.GoogleAuthProvider();
// Thêm quyền ghi lịch vào Google Calendar
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

// Đảm bảo auth persistence = LOCAL (giữ đăng nhập khi đóng/mở app)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Xử lý kết quả redirect (khi dùng signInWithRedirect trong Tauri)
auth.getRedirectResult().then((result) => {
  if (result.user) {
    console.log("Đăng nhập qua redirect thành công:", result.user.displayName);
  }
}).catch((error) => {
  console.warn("getRedirectResult error:", error.code);
});

const COLLECTION_NAME = "tasks";
const USERS_COLLECTION = "users";

// Key lưu trữ Google Access Token
const GOOGLE_ACCESS_TOKEN_KEY = "google_calendar_access_token";

export const getGoogleAccessToken = () => localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
export const setGoogleAccessToken = (token: string) => localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, token);

// Kiểm tra có đang chạy trong Tauri không
export const isTauri = (): boolean => {
  return !!(window as any).__TAURI_INTERNALS__;
};

// --- AUTH ACTIONS ---
export const signInWithGoogle = async () => {
  if (isTauri()) {
    // Trong Tauri: mở trình duyệt mặc định để đăng nhập
    try {
      const tauri = window as any;
      if (tauri.__TAURI_INTERNALS__ && tauri.__TAURI_INTERNALS__.invoke) {
        await tauri.__TAURI_INTERNALS__.invoke('plugin:shell|open', {
          path: 'https://smartcal-87.vercel.app?desktop_auth=true',
          with: null
        });
      } else {
        window.open('https://smartcal-87.vercel.app?desktop_auth=true', '_blank');
      }
    } catch (e) {
      console.error("Lỗi mở trình duyệt:", e);
      window.open('https://smartcal-87.vercel.app?desktop_auth=true', '_blank');
    }
    // Throw lỗi đặc biệt để LoginScreen biết cần hiện form paste token
    throw { code: 'auth/tauri-external', message: 'Đang mở trình duyệt...' };
  } else {
    // Trên web: dùng popup bình thường
    try {
      const result = await auth.signInWithPopup(googleProvider);

      // Lưu lại access token cho web ngay lập tức
      const credential = result.credential as any;
      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }

      // Nếu đang trong luồng cấp quyền cho Desktop App, return ID token VÀ Access Token
      const params = new URLSearchParams(window.location.search);
      if (params.get('desktop_auth') === 'true') {
        if (credential && credential.idToken) {
          // Serialize thành string để user dễ copy 1 cuộn
          return {
            type: 'oauth_token', token: JSON.stringify({
              idToken: credential.idToken,
              accessToken: credential.accessToken || ''
            })
          };
        }
      }
      return result;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  }
};

/**
 * Đăng nhập bằng Google credential token (dùng cho Tauri desktop)
 * User copy token từ web app → paste vào Tauri app
 */
export const signInWithGoogleToken = async (idToken: string) => {
  try {
    const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
    await auth.signInWithCredential(credential);
  } catch (error) {
    console.error("Token login failed", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (error) {
    console.error("Email Login failed", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    if (userCredential.user && displayName) {
      await userCredential.user.updateProfile({
        displayName: displayName
      });
    }
  } catch (error) {
    console.error("Email Signup failed", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout failed", error);
  }
};

/**
 * Lắng nghe thay đổi dữ liệu realtime từ Firestore
 * CHỈ lấy dữ liệu của userId tương ứng
 */
export const subscribeToTasks = (
  userId: string,
  callback: (tasks: Task[]) => void,
  onError: (error: any) => void
) => {
  if (!userId) return () => { };

  // Query: Lấy tasks where userId == userId
  const q = db.collection(COLLECTION_NAME).where('userId', '==', userId);

  const unsubscribe = q.onSnapshot((querySnapshot) => {
    const tasks: Task[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      const safeString = (val: any) => (typeof val === 'string' ? val : '');
      const safeBoolean = (val: any) => !!val;

      let recType: RecurringType = 'none';
      if (data.recurringType) {
        recType = data.recurringType as RecurringType;
      } else if (data.isRecurring === true) {
        recType = 'daily';
      }

      let subtasks: Subtask[] = [];
      if (Array.isArray(data.subtasks)) {
        subtasks = data.subtasks.map((st: any) => ({
          id: safeString(st.id),
          title: safeString(st.title),
          completed: safeBoolean(st.completed)
        }));
      }

      const date = safeString(data.date) || new Date().toISOString().split('T')[0];
      const endDate = safeString(data.endDate) || date;

      // --- MIGRATION LOGIC FOR TAGS ---
      let tags: string[] = [];
      if (Array.isArray(data.tags)) {
        tags = data.tags.filter((t: any) => typeof t === 'string');
      } else if (typeof data.tag === 'string' && data.tag) {
        // Fallback for old data structure
        tags = [data.tag];
      }
      if (tags.length === 0) tags = ['Khác'];
      // --------------------------------

      tasks.push({
        id: doc.id,
        userId: data.userId, // Có thể có hoặc không
        title: safeString(data.title) || "Không có tiêu đề",
        date: date,
        endDate: endDate,
        time: safeString(data.time) || "00:00",
        duration: safeString(data.duration),
        description: safeString(data.description),
        completed: safeBoolean(data.completed),
        reminderSent: safeBoolean(data.reminderSent),
        recurringType: recType,
        tags: tags,
        subtasks: subtasks,
        customStatus: data.customStatus,
        googleEventId: data.googleEventId || undefined,
        // Lunar calendar fields
        isLunarDate: safeBoolean(data.isLunarDate),
        lunarDay: typeof data.lunarDay === 'number' ? data.lunarDay : undefined,
        lunarMonth: typeof data.lunarMonth === 'number' ? data.lunarMonth : undefined,
        lunarYear: typeof data.lunarYear === 'number' ? data.lunarYear : undefined,
      });
    });

    // Client-side sorting
    tasks.sort((a, b) => {
      const timeA = `${a.date} ${a.time}`;
      const timeB = `${b.date} ${b.time}`;
      return timeA.localeCompare(timeB);
    });

    callback(tasks);
  }, (error: any) => {
    console.warn("Firestore subscription warning:", error.message);
    onError(error);
  });

  return unsubscribe;
};

/**
 * Lắng nghe thay đổi Tag từ Firestore (User specific)
 */
export const subscribeToTags = (
  userId: string,
  callback: (tags: Tag[]) => void,
  onError: (error: any) => void
) => {
  if (!userId) return () => { };

  const docRef = db.collection(USERS_COLLECTION).doc(userId).collection("config").doc("tags");

  const unsubscribe = docRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.list && Array.isArray(data.list)) {
        const sanitizedTags = data.list.map((t: any) => ({
          name: typeof t.name === 'string' ? t.name : "Thẻ lỗi",
          color: typeof t.color === 'string' ? t.color : "bg-gray-100 border-gray-300 text-gray-800",
          dot: typeof t.dot === 'string' ? t.dot : "bg-gray-500"
        }));
        callback(sanitizedTags);
      } else {
        callback(DEFAULT_TASK_TAGS);
      }
    } else {
      callback(DEFAULT_TASK_TAGS);
    }
  }, (error: any) => {
    console.warn("Firestore tags subscription error:", error);
    onError(error);
  });

  return unsubscribe;
};

/**
 * Lưu danh sách Tag lên Firestore
 */
export const saveTagsToFirestore = async (userId: string, tags: Tag[]) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Bạn chưa đăng nhập Firebase.");

  try {
    // Dùng currentUser.uid thay vì tham số userId để đảm bảo bảo mật
    const docRef = db.collection(USERS_COLLECTION).doc(currentUser.uid).collection("config").doc("tags");

    const sanitizedTags = tags.map(t => ({
      name: t.name || "Thẻ mới",
      color: t.color || "bg-gray-100 border-gray-300 text-gray-800",
      dot: t.dot || "bg-gray-500"
    }));

    await docRef.set({ list: sanitizedTags }, { merge: true });
    return true;
  } catch (e) {
    console.error("Firebase: Error saving tags", e);
    throw e;
  }
};

/**
 * MỚI: Lưu cấu hình Telegram lên Firestore để Cloud Function dùng
 */
export const saveTelegramConfigToFirestore = async (userId: string, config: TelegramConfig) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const docRef = db.collection(USERS_COLLECTION).doc(currentUser.uid).collection("config").doc("telegram");
    await docRef.set(config, { merge: true });
    console.log("Đã đồng bộ Telegram Config lên Cloud");
  } catch (e) {
    console.error("Lỗi lưu Telegram config lên Cloud", e);
  }
};

/**
 * Thêm công việc mới vào Firestore
 */
export const addTaskToFirestore = async (task: Omit<Task, 'id'>) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("Lỗi: Không tìm thấy phiên đăng nhập khi thêm Task.");
    throw new Error("User not authenticated");
  }

  try {
    // ÉP BUỘC userId phải là ID của người đang đăng nhập
    const payload = {
      userId: currentUser.uid,
      title: task.title,
      date: task.date,
      endDate: task.endDate || task.date,
      time: task.time,
      duration: task.duration || "",
      description: task.description || "",
      completed: task.completed,
      reminderSent: false,
      recurringType: task.recurringType || 'none',
      tags: task.tags || ['Khác'], // Save as array
      subtasks: task.subtasks || [],
      customStatus: task.customStatus || 'todo',
      googleEventId: task.googleEventId || null,
      // Lunar calendar fields
      isLunarDate: !!(task as any).isLunarDate,
      lunarDay: (task as any).lunarDay || null,
      lunarMonth: (task as any).lunarMonth || null,
      lunarYear: (task as any).lunarYear || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(COLLECTION_NAME).add(payload);
    return docRef.id;
  } catch (e: any) {
    console.warn("Lỗi khi thêm Task vào Firestore:", e.message);
    throw e;
  }
};

/**
 * Cập nhật công việc trong Firestore
 */
export const updateTaskInFirestore = async (task: Task) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated");

  try {
    const taskRef = db.collection(COLLECTION_NAME).doc(task.id);

    // Tạo payload sạch, đảm bảo không có trường nào là undefined
    // Firestore sẽ ném lỗi nếu gửi undefined
    const payload: Record<string, any> = {
      title: task.title || "",
      date: task.date,
      endDate: task.endDate || task.date,
      time: task.time || "00:00",
      duration: task.duration || "",
      description: task.description || "", // Quan trọng: fallback chuỗi rỗng
      completed: !!task.completed,
      reminderSent: !!task.reminderSent,
      recurringType: task.recurringType || 'none',
      tags: (task.tags && task.tags.length > 0) ? task.tags : ['Khác'],
      subtasks: task.subtasks || [],
      customStatus: task.customStatus || 'todo',
      googleEventId: task.googleEventId || null,
      // Lunar calendar fields
      isLunarDate: !!task.isLunarDate,
      lunarDay: task.lunarDay || null,
      lunarMonth: task.lunarMonth || null,
      lunarYear: task.lunarYear || null,
    };

    // Nếu có color (optional), thêm vào
    if (task.color) payload.color = task.color;

    await taskRef.update(payload);
    return true;
  } catch (e: any) {
    console.warn("Lỗi khi cập nhật Firestore:", e.message);
    throw e;
  }
};

/**
 * Xóa công việc khỏi Firestore
 */
export const deleteTaskFromFirestore = async (id: string) => {
  try {
    await db.collection(COLLECTION_NAME).doc(id).delete();
    return true;
  } catch (e) {
    console.warn("Fallback to offline: Could not delete from Firestore", e);
    throw e;
  }
};

/**
 * Xóa toàn bộ dữ liệu của người dùng và Xóa Tài Khoản
 * Thực hiện tuần tự: Xóa Tasks -> Xóa Config -> Xóa Tài khoản
 */
export const deleteUserAccountAndData = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Chưa đăng nhập.");

  const uid = currentUser.uid;

  try {
    // 1. Xóa tất cả Tasks của user
    const tasksSnapshot = await db.collection(COLLECTION_NAME).where('userId', '==', uid).get();
    const batch = db.batch();

    tasksSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Nếu có quá nhiều tasks, thực tế nên dùng pagination delete.
    // Với app cá nhân, batch (< 500 ops) thường là đủ.
    if (!tasksSnapshot.empty) {
      await batch.commit();
      console.log(`Đã xóa ${tasksSnapshot.docs.length} tasks.`);
    }

    // 2. Xóa các file cấu hình (Tags, Telegram, fcm)
    const configPath = db.collection(USERS_COLLECTION).doc(uid).collection("config");

    const tagsDoc = await configPath.doc("tags").get();
    if (tagsDoc.exists) await configPath.doc("tags").delete();

    const telegramDoc = await configPath.doc("telegram").get();
    if (telegramDoc.exists) await configPath.doc("telegram").delete();

    // 3. Xóa FCM token nếu có (Mặc dù nó nằm trong users/{uid}/fcm_tokens)
    const fcmPath = db.collection(USERS_COLLECTION).doc(uid).collection("fcm_tokens");
    const fcmSnapshot = await fcmPath.get();
    const fcmBatch = db.batch();
    fcmSnapshot.docs.forEach((doc) => {
      fcmBatch.delete(doc.ref);
    });
    if (!fcmSnapshot.empty) {
      await fcmBatch.commit();
      console.log(`Đã xóa FCM tokens.`);
    }

    // Cuối cùng: Xóa Document chính của User (nếu có)
    const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
    if (userDoc.exists) await userDoc.ref.delete();

    // 4. Xóa User Auth Account
    await currentUser.delete();
    console.log("Đã xóa tài khoản Firebase Auth thành công.");

    return true;
  } catch (error: any) {
    console.error("Lỗi khi dọn rác và xóa tài khoản:", error);
    // Nếu lỗi là 'auth/requires-recent-login', ném lại để UI xử lý thông báo cho user đăng nhập lại
    if (error.code === 'auth/requires-recent-login') {
      throw new Error("requires-recent-login");
    }
    throw error;
  }
};