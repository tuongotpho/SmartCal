
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import { Task, RecurringType, Tag, DEFAULT_TASK_TAGS, Subtask } from "../types";

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

const COLLECTION_NAME = "tasks";
// const CONFIG_COLLECTION = "config"; // Old global config
const USERS_COLLECTION = "users";

// --- AUTH ACTIONS ---
export const signInWithGoogle = async () => {
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (error) {
    console.error("Login failed", error);
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
  if (!userId) return () => {};

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

      tasks.push({
        id: doc.id,
        userId: data.userId, // Có thể có hoặc không
        title: safeString(data.title) || "Không có tiêu đề",
        date: date,
        endDate: endDate,
        time: safeString(data.time) || "00:00",
        description: safeString(data.description),
        completed: safeBoolean(data.completed),
        reminderSent: safeBoolean(data.reminderSent),
        recurringType: recType,
        tag: safeString(data.tag),
        subtasks: subtasks
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
 * Path: users/{userId}/config/tags
 */
export const subscribeToTags = (
  userId: string,
  callback: (tags: Tag[]) => void,
  onError: (error: any) => void
) => {
  if (!userId) return () => {};

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
      // Nếu user chưa có config riêng, trả về default (không tự ghi đè để tiết kiệm write)
      callback(DEFAULT_TASK_TAGS);
    }
  }, (error: any) => {
    console.warn("Firestore tags subscription error:", error);
    onError(error);
  });

  return unsubscribe;
};

/**
 * Lưu danh sách Tag lên Firestore (User specific)
 */
export const saveTagsToFirestore = async (userId: string, tags: Tag[]) => {
  if (!userId) throw new Error("User not authenticated");
  try {
    const docRef = db.collection(USERS_COLLECTION).doc(userId).collection("config").doc("tags");
    
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
 * Thêm công việc mới vào Firestore (Có userId)
 */
export const addTaskToFirestore = async (task: Omit<Task, 'id'>) => {
  if (!task.userId) {
     console.warn("Attempted to add task without userId. Fallback to offline mode might happen.");
     // Vẫn cho phép add nhưng sẽ không query lại được nếu bật rule security chặt
  }
  try {
    await db.collection(COLLECTION_NAME).add({
      userId: task.userId, // Quan trọng: Lưu ID người dùng
      title: task.title,
      date: task.date,
      endDate: task.endDate || task.date,
      time: task.time,
      description: task.description || "",
      completed: task.completed,
      reminderSent: false,
      recurringType: task.recurringType || 'none',
      tag: task.tag || 'Khác',
      subtasks: task.subtasks || [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (e) {
    console.warn("Fallback to offline: Could not add to Firestore", e);
    throw e;
  }
};

/**
 * Cập nhật công việc trong Firestore
 */
export const updateTaskInFirestore = async (task: Task) => {
  try {
    const taskRef = db.collection(COLLECTION_NAME).doc(task.id);
    const { id, isRecurring, ...dataToUpdate } = task; 
    await taskRef.update({
        ...dataToUpdate,
        endDate: task.endDate || task.date,
        recurringType: task.recurringType || 'none',
        subtasks: task.subtasks || []
    });
    return true;
  } catch (e) {
    console.warn("Fallback to offline: Could not update Firestore", e);
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