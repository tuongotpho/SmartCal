
/**
 * Service hỗ trợ phản hồi xúc giác (vibration) trên thiết bị di động
 */
export const hapticFeedback = {
  // Rung nhẹ khi thành công hoặc thao tác nhẹ
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  
  // Rung vừa khi hoàn thành tác vụ
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },
  
  // Rung cảnh báo hoặc lỗi
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([40, 30, 40]);
    }
  },
  
  // Rung khi xóa
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }
};
