import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
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

const COLLECTION_NAME = "tasks";
const CONFIG_COLLECTION = "config";

/**
 * Lắng nghe thay đổi dữ liệu realtime từ Firestore
 * @param callback Hàm callback nhận danh sách tasks mới
 * @param onError Hàm callback khi có lỗi kết nối
 * @returns Hàm unsubscribe để hủy lắng nghe
 */
export const subscribeToTasks = (
  callback: (tasks: Task[]) => void,
  onError: (error: any) => void
) => {
  // QUAN TRỌNG: Không dùng orderBy ở đây để tránh lỗi "The query requires an index".
  // Chúng ta sẽ lấy dữ liệu về và sắp xếp ở phía Client (trình duyệt).
  const q = db.collection(COLLECTION_NAME);
  
  const unsubscribe = q.onSnapshot((querySnapshot) => {
    const tasks: Task[] = [];
    querySnapshot.forEach((doc) => {
      // Ép kiểu dữ liệu trả về từ Firestore và sanitize để tránh lỗi Circular JSON
      const data = doc.data();
      
      // Helper function để đảm bảo giá trị là string, tránh object/reference
      const safeString = (val: any) => (typeof val === 'string' ? val : '');
      const safeBoolean = (val: any) => !!val;

      // Xử lý migration: Nếu dữ liệu cũ có isRecurring=true, gán thành 'daily'
      let recType: RecurringType = 'none';
      if (data.recurringType) {
        recType = data.recurringType as RecurringType;
      } else if (data.isRecurring === true) {
        recType = 'daily';
      }

      // Sanitize subtasks
      let subtasks: Subtask[] = [];
      if (Array.isArray(data.subtasks)) {
        subtasks = data.subtasks.map((st: any) => ({
          id: safeString(st.id),
          title: safeString(st.title),
          completed: safeBoolean(st.completed)
        }));
      }

      const date = safeString(data.date) || new Date().toISOString().split('T')[0];
      const endDate = safeString(data.endDate) || date; // Fallback endDate bằng date nếu không có

      tasks.push({
        id: doc.id,
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

    // Sắp xếp dữ liệu ngay tại Client (Client-side sorting)
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
 * Lắng nghe thay đổi Tag từ Firestore
 */
export const subscribeToTags = (
  callback: (tags: Tag[]) => void,
  onError: (error: any) => void
) => {
  const docRef = db.collection(CONFIG_COLLECTION).doc("tags");
  
  const unsubscribe = docRef.onSnapshot((docSnap) => {
    // Trong Firestore compat/v8, .exists là property boolean, không phải function
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.list && Array.isArray(data.list)) {
        // Sanitize tags to avoid circular structure errors (e.g., DocumentReference)
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
      // Nếu chưa có config trên server, trả về default nhưng KHÔNG tự ghi đè lên server ở đây để tránh race condition
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
export const saveTagsToFirestore = async (tags: Tag[]) => {
  try {
    const docRef = db.collection(CONFIG_COLLECTION).doc("tags");
    
    // Sanitize: Tạo object mới sạch sẽ, loại bỏ undefined, đảm bảo đúng format
    const sanitizedTags = tags.map(t => ({
      name: t.name || "Thẻ mới",
      color: t.color || "bg-gray-100 border-gray-300 text-gray-800",
      dot: t.dot || "bg-gray-500"
    }));

    await docRef.set({ list: sanitizedTags }, { merge: true });
    console.log("Firebase: Saved tags successfully", sanitizedTags);
    return true;
  } catch (e) {
    console.error("Firebase: Error saving tags", e);
    throw e;
  }
};

/**
 * Thêm công việc mới vào Firestore
 */
export const addTaskToFirestore = async (task: Omit<Task, 'id'>) => {
  try {
    await db.collection(COLLECTION_NAME).add({
      title: task.title,
      date: task.date,
      endDate: task.endDate || task.date, // Lưu endDate
      time: task.time,
      description: task.description || "",
      completed: task.completed,
      reminderSent: false,
      recurringType: task.recurringType || 'none',
      tag: task.tag || 'Khác',
      subtasks: task.subtasks || [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp() // Sử dụng thời gian của server
    });
    return true;
  } catch (e) {
    console.warn("Fallback to offline: Could not add to Firestore", e);
    throw e; // Ném lỗi để App xử lý fallback
  }
};

/**
 * Cập nhật công việc trong Firestore
 */
export const updateTaskInFirestore = async (task: Task) => {
  try {
    const taskRef = db.collection(COLLECTION_NAME).doc(task.id);
    // Loại bỏ id khỏi data object khi update
    const { id, isRecurring, ...dataToUpdate } = task; 
    await taskRef.update({
        ...dataToUpdate,
        endDate: task.endDate || task.date, // Đảm bảo update endDate
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
