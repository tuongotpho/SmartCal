
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Kiểm tra nhanh trùng giờ tuyệt đối bằng code (Local)
 */
const checkLocalConflicts = (proposedTask: Partial<Task>, existingTasks: Task[]): string[] => {
  const localConflicts: string[] = [];
  const pDate = proposedTask.date;
  const pTime = proposedTask.time;

  if (!pDate || !pTime) return [];

  existingTasks.forEach(task => {
    if (!task.completed && task.date === pDate && task.time === pTime) {
      localConflicts.push(`Trùng khớp hoàn toàn với "${task.title}" lúc ${task.time}`);
    }
  });

  return localConflicts;
};

export const parseTaskWithGemini = async (input: string, availableTags: string[]): Promise<{ title: string; date: string; endDate: string; time: string; duration: string; description: string; recurringType: string; tags: string[] } | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tagsToUse = availableTags.length > 0 ? availableTags : ['Khác'];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Phân tích: "${input}". Hôm nay: ${today}. Trả về JSON lịch việc.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            endDate: { type: Type.STRING },
            time: { type: Type.STRING },
            duration: { type: Type.STRING },
            description: { type: Type.STRING },
            recurringType: { type: Type.STRING, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
            tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: tagsToUse } }
          },
          required: ["title", "date", "time"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      if (!data.endDate) data.endDate = data.date;
      return data;
    }
    return null;
  } catch (error) {
    console.error("Gemini error:", error);
    return null;
  }
};

/**
 * Phân tích xung đột. Sử dụng model Flash để đạt tốc độ cao nhất.
 */
export const checkProposedTaskConflict = async (proposedTask: Partial<Task>, existingTasks: Task[]): Promise<string[]> => {
  // BƯỚC 1: Kiểm tra cục bộ (0ms)
  const local = checkLocalConflicts(proposedTask, existingTasks);
  if (local.length > 0) return local;

  // BƯỚC 2: Gọi AI kiểm tra các xung đột phức tạp hơn (quá sát giờ)
  try {
    const activeTasks = existingTasks
      .filter(t => !t.completed && t.date === proposedTask.date)
      .map(t => ({ title: t.title, time: t.time }));

    if (activeTasks.length === 0) return [];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Check trùng lịch: Việc mới "${proposedTask.title}" lúc ${proposedTask.time} ngày ${proposedTask.date}. Việc hiện có: ${JSON.stringify(activeTasks)}. Trả về JSON mảng string cảnh báo nếu trùng hoặc sát <30p. Trống [] nếu OK.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Conflict check error:", error);
    return [];
  }
};

export const analyzeScheduleConflicts = async (tasks: Task[]): Promise<string[]> => {
  try {
    const simpleTasks = tasks.filter(t => !t.completed).map(t => ({ title: t.title, date: t.date, time: t.time }));
    if (simpleTasks.length < 2) return [];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tìm trùng/sát lịch trong 30p: ${JSON.stringify(simpleTasks)}. Trả về JSON mảng string cảnh báo ngắn.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
};

export const suggestSubtasks = async (taskTitle: string, taskDescription?: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Chia nhỏ việc: "${taskTitle}" (${taskDescription || ''}) thành 3-5 bước. Trả về mảng JSON string.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
};

export const generateReport = async (tasks: Task[], range: string): Promise<string> => {
  try {
    const tasksData = tasks.map(t => ({ title: t.title, date: t.date, status: t.completed ? "Xong" : "Chưa" }));
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Báo cáo năng suất ${range}: ${JSON.stringify(tasksData)}. Trả về HTML (h4, ul, li).`
    });
    return response.text || "";
  } catch (error) {
    return "Lỗi tạo báo cáo.";
  }
};

export const chatWithCalendar = async (question: string, tasks: Task[]): Promise<string> => {
  try {
    const simpleTasks = tasks.map(t => ({ title: t.title, date: t.date, time: t.time, status: t.completed ? "Xong" : "Chưa" }));
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Thư ký AI. Câu hỏi: "${question}". Dữ liệu: ${JSON.stringify(simpleTasks)}. Trả về HTML.`
    });
    return response.text || "Tôi không hiểu câu hỏi.";
  } catch (error) {
    return "Lỗi AI.";
  }
};
