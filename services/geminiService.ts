
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

// Hàm khởi tạo AI
const getAiClient = () => {
  // Chỉ lấy từ LocalStorage (Người dùng tự nhập trên giao diện)
  const apiKey = localStorage.getItem('gemini_api_key');
  
  if (!apiKey) {
    // Trả về null để UI xử lý hiển thị thông báo yêu cầu nhập key
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const parseTaskWithGemini = async (input: string, availableTags: string[]): Promise<{ title: string; date: string; endDate: string; time: string; duration: string; description: string; recurringType: string; tag: string } | null> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("Vui lòng nhập API Key Gemini trong phần Cài đặt.");

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

      Quy tắc phân loại Thẻ (tag):
      - Dựa vào nội dung để đoán 1 trong các thẻ sau: ${JSON.stringify(tagsToUse)}.
      - Nếu không chắc chắn, hãy chọn thẻ phù hợp nhất hoặc "Khác".

      Trả về JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
            tag: { type: Type.STRING, enum: tagsToUse, description: "Phân loại công việc" }
          },
          required: ["title", "date", "time"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (!data.endDate) data.endDate = data.date;
      return data;
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi gọi Gemini:", error);
    // Ném lỗi ra để UI catch và hiển thị Toast
    throw error;
  }
};

export const generateReport = async (tasks: Task[], range: string): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "<p style='color:red'>Chưa cấu hình API Key. Vui lòng vào Cài đặt để nhập key.</p>";

    const tasksData = tasks.map(t => ({
      title: t.title,
      date: t.date,
      endDate: t.endDate,
      status: t.completed ? "Đã xong" : "Chưa xong",
      tag: t.tag || "Khác"
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
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Không thể tạo báo cáo lúc này.";
  } catch (error) {
    console.error("Lỗi tạo báo cáo:", error);
    return "<p>Đã xảy ra lỗi khi kết nối với Trợ lý AI.</p>";
  }
};
