
import { Task, TelegramConfig } from "../types";

export const sendTelegramMessage = async (config: TelegramConfig, message: string) => {
  if (!config.botToken || !config.chatId) return;
  
  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error("Failed to send Telegram message", error);
  }
};

export const fetchTelegramUpdates = async (config: TelegramConfig, offset: number = 0): Promise<{ update_id: number; message: string }[]> => {
  if (!config.botToken) return [];

  try {
    // Thêm tham số offset để Telegram biết bỏ qua các tin nhắn cũ đã xử lý
    const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?limit=10&offset=${offset}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.ok && Array.isArray(data.result)) {
      // Trả về cả update_id để client lưu lại trạng thái
      return data.result
        .filter((update: any) => update.message && update.message.text)
        .map((update: any) => ({
          update_id: update.update_id,
          message: update.message.text
        }));
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch updates", error);
    return [];
  }
};

export const formatTaskForTelegram = (task: Task): string => {
  return `🚨 <b>NHẮC NHỞ: ĐẾN GIỜ LÀM VIỆC!</b> 🚨\n\n📌 <b>${task.title}</b>\n⏰ <b>${task.time}</b> - ${task.date}\n\n📝 ${task.description || "<i>(Không có ghi chú)</i>"}\n\n👉 <i>Hãy hoàn thành và đánh dấu "Đã xong" trên SmartCal nhé!</i>`;
};