
import { Task } from "../types";

export const generateGoogleCalendarLink = (task: Task): string => {
  try {
    // Tạo đối tượng Date từ string ngày giờ của task
    const startTime = new Date(`${task.date}T${task.time}`);
    
    // Mặc định sự kiện kéo dài 1 tiếng
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    // Format ngày tháng theo chuẩn của Google Calendar: YYYYMMDDTHHMMSS
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const startStr = formatDate(startTime);
    const endStr = formatDate(endTime);

    const title = encodeURIComponent(task.title);
    const details = encodeURIComponent(task.description || "");
    const location = encodeURIComponent(""); // Có thể thêm địa điểm nếu muốn

    // Tạo link render action
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  } catch (error) {
    console.error("Lỗi tạo link calendar", error);
    return "#";
  }
};
