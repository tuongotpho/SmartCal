
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

// Initialize AI Client once using the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Updated model to gemini-3-flash-preview and used response.text property as per guidelines
export const parseTaskWithGemini = async (input: string, availableTags: string[]): Promise<{ title: string; date: string; endDate: string; time: string; duration: string; description: string; recurringType: string; tags: string[] } | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0-6
    
    const tagsToUse = availableTags.length > 0 ? availableTags : ['Khác'];

    const prompt = `
      Hôm nay là ngày: ${today} (Thứ ${dayOfWeek === 0 ? 'CN' : dayOfWeek + 1}).
      Hãy phân tích văn bản sau để tạo lịch: "${input}".
      
      Quy tắc phân loại lặp lại (recurringType):
      - "mỗi ngày", "hàng ngày", "daily" -> 'daily'
      - "mỗi tuần", "hàng tuần", "thứ 2 hàng tuần" -> 'weekly'
      - "mỗi tháng", "hàng tháng", "ngày 15 hàng tháng" -> 'monthly'
      - "mỗi năm", "hàng năm", "sinh nhật" -> 'yearly'
      - Nếu không nói gì về lặp -> 'none'

      Quy tắc ngày tháng (date & endDate):
      - Nếu người dùng nói "từ ngày X đến ngày Y" hoặc "trong 3 ngày", hãy xác định endDate.
      - Nếu chỉ có 1 ngày, endDate = date.
      - Định dạng YYYY-MM-DD.
      
      Quy tắc thời lượng (duration):
      - Nếu có thông tin về thời gian kéo dài (VD: "trong 30 phút", "1 tiếng", "1h30p"), hãy trích xuất vào duration (dạng text ngắn gọn).
      - Nếu không có, để trống.

      Quy tắc phân loại Thẻ (tags):
      - Chọn 1 hoặc nhiều thẻ phù hợp nhất từ danh sách sau: ${JSON.stringify(tagsToUse)}.
      - Trả về mảng các string. Nếu không chắc, chọn ["Khác"].

      Trả về JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Tên ngắn gọn của công việc" },
            date: { type: Type.STRING, description: "Ngày bắt đầu YYYY-MM-DD" },
            endDate: { type: Type.STRING, description: "Ngày kết thúc YYYY-MM-DD (nếu không có thì bằng date)" },
            time: { type: Type.STRING, description: "Giờ diễn ra HH:mm (24h)" },
            duration: { type: Type.STRING, description: "Thời lượng công việc (VD: 30p, 1h). Để trống nếu không có." },
            description: { type: Type.STRING, description: "Chi tiết công việc hoặc ghi chú thêm" },
            recurringType: { type: Type.STRING, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], description: "Loại lặp lại" },
            tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: tagsToUse }, description: "Danh sách thẻ phân loại" }
          },
          required: ["title", "date", "time"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      if (!data.endDate) data.endDate = data.date;
      if (!data.tags || data.tags.length === 0) data.tags = ['Khác'];
      return data;
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi gọi Gemini:", error);
    throw error;
  }
};

// Fix: Updated model to gemini-3-flash-preview
export const suggestSubtasks = async (taskTitle: string, taskDescription?: string): Promise<string[]> => {
  try {
    const prompt = `
      Tôi có một công việc: "${taskTitle}"
      Chi tiết: "${taskDescription || ''}"
      
      Hãy chia nhỏ công việc này thành 3 đến 7 bước cụ thể, ngắn gọn để tôi dễ thực hiện (Checklist).
      Chỉ trả về danh sách các đầu mục, không cần đánh số hay thêm lời dẫn.
      
      Ví dụ input: "Làm bánh bông lan"
      Output JSON: ["Chuẩn bị nguyên liệu (bột, trứng, sữa)", "Đánh trứng và trộn bột", "Làm nóng lò nướng", "Đổ khuôn và nướng bánh", "Kiểm tra và trang trí"]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.ARRAY,
           items: { type: Type.STRING }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      if (Array.isArray(data)) return data;
    }
    return [];
  } catch (error) {
    console.error("Lỗi tạo subtasks:", error);
    return [];
  }
};

// Fix: Updated model to gemini-3-flash-preview
export const generateReport = async (tasks: Task[], range: string): Promise<string> => {
  try {
    const tasksData = tasks.map(t => ({
      title: t.title,
      date: t.date,
      endDate: t.endDate,
      status: t.completed ? "Đã xong" : "Chưa xong",
      tags: t.tags?.join(", ") || "Khác"
    }));

    const prompt = `
      Bạn là một Chuyên gia Phân tích Năng suất (Productivity Expert).
      Dưới đây là dữ liệu công việc của tôi trong ${range}:
      ${JSON.stringify(tasksData)}

      Hãy viết một báo cáo tổng kết chuyên nghiệp.
      
      **Yêu cầu định dạng đầu ra:**
      - Trả về mã **HTML** thuần (không dùng Markdown, không thẻ html/body).
      - Sử dụng thẻ <h4> cho các tiêu đề mục.
      - Sử dụng thẻ <ul>, <li>, <strong>, <p>.
      
      **Cấu trúc báo cáo:**
      1. <h4>📊 Tổng quan</h4>: Số lượng công việc (Tổng/Đã xong/Chưa xong).
      2. <h4>🏷️ Phân tích xu hướng</h4>: Tôi đang tập trung vào nhóm việc (Thẻ) nào?
      3. <h4>💡 Đánh giá & Lời khuyên</h4>: Nhận xét và lời khuyên.

      **Văn phong:**
      - Chuyên nghiệp, tích cực, ngắn gọn.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Không thể tạo báo cáo lúc này.";
  } catch (error) {
    console.error("Lỗi tạo báo cáo:", error);
    return "<p>Đã xảy ra lỗi khi kết nối với Trợ lý AI.</p>";
  }
};

// Fix: Updated model to gemini-3-flash-preview
export const chatWithCalendar = async (question: string, tasks: Task[]): Promise<string> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const simpleTasks = tasks.map(t => ({
       title: t.title,
       date: t.date,
       time: t.time,
       status: t.completed ? "Đã hoàn thành" : "Chưa làm",
       tags: t.tags,
       description: t.description
    }));

    const prompt = `
      Hôm nay là: ${today}.
      Bạn là Thư ký riêng chuyên nghiệp của người dùng.
      
      Người dùng hỏi: "${question}"
      
      Dữ liệu lịch trình của người dùng:
      ${JSON.stringify(simpleTasks)}

      **Yêu cầu:**
      1. Trả lời bằng định dạng **HTML** (không dùng Markdown block \`\`\`html).
      2. Nếu câu hỏi liên quan đến lịch trình/công việc, hãy trình bày dạng báo cáo chuyên nghiệp.
      3. Nếu là câu chào xã giao, trả lời ngắn gọn thân thiện.

      **Quy tắc định dạng HTML cho lịch trình:**
      - Sử dụng thẻ <b> để in đậm các thông tin quan trọng (Ngày, Tổng kết).
      - Sử dụng thẻ <ul style="margin-top: 5px; padding-left: 15px; list-style-type: disc;"> và <li> để liệt kê công việc.
      - Mỗi công việc hiển thị theo format: 
        <li><b>Giờ</b>: Tên công việc - <i style="color: #666;">[Trạng thái]</i></li>
      - Dùng biểu tượng cảm xúc phù hợp: ✅ (Đã xong), ⏳ (Chưa làm), 📅 (Lịch), 🚨 (Gấp).
      - Xuống dòng dùng <br/>.

      Ví dụ output mong muốn:
      "Dưới đây là lịch trình ngày mai của bạn:<br/>
      <b>📅 Ngày 2024-05-20:</b>
      <ul style="padding-left: 20px;">
         <li><b>08:00</b>: Họp team marketing - <i>✅ Đã xong</i></li>
         <li><b>14:00</b>: Gặp khách hàng - <i>⏳ Chưa làm</i></li>
      </ul>
      <br/>Bạn nhớ chuẩn bị tài liệu nhé!"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Xin lỗi, tôi không hiểu câu hỏi.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Đã xảy ra lỗi khi kết nối AI.";
  }
};
