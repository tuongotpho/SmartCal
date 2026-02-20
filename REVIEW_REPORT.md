# 📊 BÁO CÁO RÀ SOÁT SMARTCAL

**Ngày rà soát:** 19/02/2026  
**Phiên bản:** v2.8.0

---

## 1. TỔNG QUAN ỨNG DỤNG

### 1.1 Mô tả
SmartCal là ứng dụng quản lý công việc thông minh với tích hợp AI (Gemini), hỗ trợ:
- Quản lý công việc đa dạng (Task Management)
- Tích hợp Telegram Bot để nhắc việc
- Đồng bộ dữ liệu qua Firebase
- Hỗ trợ PWA (Progressive Web App)
- Nhiều chế độ xem: Calendar, Kanban, Timeline, Focus, Stats

### 1.2 Tech Stack
| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Firebase Firestore + Cloud Functions |
| AI | Google Gemini API |
| Notifications | Telegram Bot API + Browser Notifications |
| Styling | Tailwind CSS |
| PWA | Service Worker + Web App Manifest |

---

## 2. TÍNH NĂNG HIỆN CÓ

### 2.1 Quản lý Công việc ✅
- [x] Tạo/Sửa/Xóa công việc
- [x] Thiết lập ngày giờ, thời lượng
- [x] Công việc lặp lại (daily/weekly/monthly/yearly)
- [x] Phân loại bằng Tags (nhiều tag cho 1 task)
- [x] Subtasks/Checklist
- [x] Đánh dấu hoàn thành
- [x] Ghi chú/Mô tả

### 2.2 Chế độ Xem ✅
- [x] **MONTH** - Lịch tháng
- [x] **WEEK** - Lịch tuần
- [x] **DAY** - Lịch ngày
- [x] **LIST** - Danh sách công việc
- [x] **KANBAN** - Bảng Kanban (Todo/In Progress/Done)
- [x] **TIMELINE** - Dòng thời gian
- [x] **FOCUS** - Pomodoro Timer
- [x] **STATS** - Thống kê năng suất

### 2.3 Tích hợp AI ✅
- [x] Nhập công việc bằng ngôn ngữ tự nhiên
- [x] Phát hiện xung đột lịch trình
- [x] Gợi ý chia nhỏ công việc (Subtasks)
- [x] Tạo báo cáo năng suất
- [x] Chatbot trợ lý ảo

### 2.4 Nhắc việc ✅
- [x] Browser Notifications
- [x] Telegram Bot Messages
- [x] Cloud Functions (Server-side reminders)
  - Daily reminder lúc 6:00 AM
  - Realtime reminder mỗi 5 phút

### 2.5 Đồng bộ & Lưu trữ ✅
- [x] Firebase Authentication (Google, Email)
- [x] Firestore Database
- [x] Offline Mode với LocalStorage
- [x] Đồng bộ Telegram Config lên Cloud

### 2.6 Giao diện ✅
- [x] Dark Mode
- [x] Multi-theme (Orange, Blue, Purple)
- [x] Responsive Design
- [x] Mobile Navigation
- [x] Pull-to-refresh

---

## 3. ĐÁNH GIÁ CHẤT LƯỢNG CODE

### 3.1 Điểm Mạnh 💪

| Khía cạnh | Đánh giá | Chi tiết |
|-----------|----------|----------|
| **Cấu trúc** | ⭐⭐⭐⭐ | Tách biệt rõ ràng: components, services, types |
| **TypeScript** | ⭐⭐⭐⭐ | Type definitions đầy đủ trong types.ts |
| **React Patterns** | ⭐⭐⭐⭐ | Sử dụng Hooks, useCallback, useMemo hiệu quả |
| **Error Handling** | ⭐⭐⭐ | Có try-catch, fallback cho AI failures |
| **UX/UI** | ⭐⭐⭐⭐⭐ | Giao diện đẹp, animations mượt, dark mode |
| **PWA** | ⭐⭐⭐⭐ | Service Worker, manifest, installable |
| **Realtime** | ⭐⭐⭐⭐⭐ | Firestore onSnapshot cho sync realtime |

### 3.2 Điểm Yếu & Vấn đề ⚠️

| Vấn đề | Mức độ | File | Mô tả |
|--------|--------|------|-------|
| **Firebase Config Hardcoded** | 🔴 Cao | firebase.ts:7-15 | API keys lộ trong source code |
| **API Key Exposure** | 🔴 Cao | geminiService.ts:5 | `process.env.API_KEY` không an toàn cho client |
| **No Input Validation** | 🟡 TB | EditTaskModal.tsx | Thiết lập validation cơ bản |
| **No Unit Tests** | 🟡 TB | - | Không có test files |
| **Large Components** | 🟡 TB | App.tsx (577 lines) | Nên tách nhỏ hơn |
| **Missing Error Boundaries** | 🟢 Thấp | - | Chỉ có 1 ErrorBoundary component |
| **No Rate Limiting** | 🟡 TB | geminiService.ts | AI calls không có throttle |
| **Memory Leaks Risk** | 🟡 TB | App.tsx | Một số useEffect cần cleanup tốt hơn |

### 3.3 Vấn đề Bảo mật

```
🔴 CRITICAL: Firebase config exposed in client code
- File: services/firebase.ts
- Risk: Bất kỳ ai cũng có thể đọc được config từ bundle
- Solution: Sử dụng Firebase App Check hoặc environment variables

🔴 CRITICAL: Gemini API Key in client
- File: services/geminiService.ts
- Risk: API key có thể bị đánh cắp và sử dụng sai mục đích
- Solution: Gọi AI qua Cloud Functions backend
```

---

## 4. ROADMAP NÂNG CẤP

### Phase 1: Bảo mật & Ổn định (1-2 tuần) 🔐

| Task | Mức độ | Mô tả |
|------|--------|-------|
| Move API Keys to Backend | 🔴 Critical | Di chuyển Gemini API key sang Cloud Functions |
| Firebase App Check | 🔴 Critical | Implement App Check để ngăn chặn abuse |
| Environment Variables | 🟡 Medium | Sử dụng .env cho config nhạy cảm |
| Error Monitoring | 🟡 Medium | Tích hợp Sentry hoặc LogRocket |
| Input Sanitization | 🟡 Medium | Validate và sanitize user input |

### Phase 2: Tính năng Mới (2-4 tuần) ✨

| Tính năng | Mô tả | Độ ưu tiên |
|-----------|-------|------------|
| **Recurring Tasks Logic** | Tự động tạo task mới theo chu kỳ | 🔴 Cao |
| **Push Notifications** | Web Push cho mobile | 🔴 Cao |
| **Task Templates** | Mẫu công việc có sẵn | 🟡 TB |
| **Collaboration** | Chia sẻ task với người khác | 🟡 TB |
| **Calendar Sync** | Đồng bộ 2 chiều với Google Calendar | 🟡 TB |
| **Voice Commands** | Điều khiển bằng giọng nói | 🟢 Thấp |
| **Smart Suggestions** | AI gợi ý thời gian tối ưu | 🟢 Thấp |

### Phase 3: Cải thiện UX (2-3 tuần) 🎨

| Cải thiện | Mô tả |
|-----------|-------|
| **Onboarding Flow** | Hướng dẫn người dùng mới |
| **Keyboard Shortcuts** | Phím tắt cho power users |
| **Drag & Drop** | Kéo thả task giữa các ngày |
| **Bulk Actions** | Chọn nhiều task cùng lúc |
| **Advanced Search** | Tìm kiếm với filters |
| **Export/Import** | Xuất/nhập dữ liệu (JSON, CSV) |

### Phase 4: Performance & Scale (1-2 tuần) ⚡

| Task | Mô tả |
|------|-------|
| **Code Splitting** | Lazy load các view components |
| **Firestore Indexes** | Tối ưu queries |
| **Caching Strategy** | Cache AI responses |
| **Bundle Optimization** | Giảm bundle size |
| **Service Worker Updates** | Caching strategy tốt hơn |

### Phase 5: Mobile App (4-6 tuần) 📱

| Platform | Mô tả |
|----------|-------|
| **React Native** | Native mobile app |
| **Offline First** | Hoạt động hoàn toàn offline |
| **Background Sync** | Đồng bộ khi app ở background |
| **Native Notifications** | Push notifications native |

---

## 5. CHI TIẾT TÍNH NĂNG ĐỀ XUẤT

### 5.1 Recurring Tasks Logic (Ưu tiên cao)

**Vấn đề hiện tại:** 
- Task có field `recurringType` nhưng không có logic tự động tạo task mới

**Giải pháp:**
```typescript
// Thêm Cloud Function mới
export const generateRecurringTasks = functions.pubsub
  .schedule("0 0 * * *") // Chạy mỗi đêm
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async (context) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    
    // Tìm các task recurring có date = today
    const recurringTasks = await db
      .collection("tasks")
      .where("date", "==", todayStr)
      .where("recurringType", "in", ["daily", "weekly", "monthly", "yearly"])
      .get();
    
    // Tạo task mới cho lần tiếp theo
    for (const doc of recurringTasks.docs) {
      const task = doc.data();
      const nextDate = calculateNextDate(task.date, task.recurringType);
      
      // Kiểm tra xem task cho nextDate đã tồn tại chưa
      // Nếu chưa, tạo mới
    }
  });
```

### 5.2 Web Push Notifications

**Lợi ích:**
- Hoạt động ngay cả khi tab đóng
- Không cần Telegram
- Native experience

**Implementation:**
```typescript
// Sử dụng Firebase Cloud Messaging
import { getMessaging, onMessage } from "firebase/messaging";

// Request permission
const messaging = getMessaging();
getToken(messaging, { vapidKey: "YOUR_VAPID_KEY" });

// Subscribe to topics
subscribeToTopic(userId);
```

### 5.3 Task Collaboration

**Features:**
- Share task với email
- Real-time collaboration
- Comments & Activity log
- Assignee management

**Data Model:**
```typescript
interface SharedTask extends Task {
  sharedWith: string[]; // emails
  owner: string;
  assignees: string[];
  comments: Comment[];
  activityLog: Activity[];
}
```

---

## 6. KẾT LUẬN

### 6.1 Điểm số tổng thể

| Tiêu chí | Điểm | Ghi chú |
|----------|------|---------|
| Tính năng | 8/10 | Đầy đủ, cần bổ sung recurring logic |
| Giao diện | 9/10 | Đẹp, responsive, dark mode |
| Bảo mật | 5/10 | Cần cải thiện gấp API keys |
| Performance | 7/10 | Tốt, có thể tối ưu thêm |
| Code Quality | 7/10 | Cần tests và refactoring |
| **Tổng** | **7.2/10** | Ứng dụng tiềm năng |

### 6.2 Ưu tiên hành động

1. **🔴 NGAY LẬP TỨC:** Di chuyển API keys sang backend
2. **🟠 TRONG TUẦN:** Implement recurring tasks logic
3. **🟡 TRONG THÁNG:** Thêm Web Push Notifications
4. **🟢 SAU ĐÓ:** Collaboration features, Mobile app

---

*Báo cáo được tạo tự động bởi AI Code Review*

---

## 7. CHI TIẾT RÀ SOÁT TÍNH NĂNG THÔNG BÁO (MỚI)

**Ngày rà soát:** 20/02/2026

### 7.1 Hiện trạng triển khai
Hệ thống hiện tại đang sử dụng song song 2 cơ chế thông báo:
1. **Browser Notification (Local):**
   - Sử dụng `new Notification()` trực tiếp trong `App.tsx` (dòng 248).
   - Dùng để nhắc việc khi ứng dụng đang mở (Foreground).

2. **Web Push Notification (FCM):**
   - Backend (`functions/src/index.ts`) đã có logic gửi FCM message (cron job 6:00 AM & realtime check).
   - Client (`services/fcmService.ts`) đã có logic xin quyền, lấy token và lưu vào Firestore.
   - Service Worker (`public/firebase-messaging-sw.js`) đã được tạo để xử lý background message.

### 7.2 Vấn đề phát hiện
1. **Xung đột Service Worker (Quan trọng):**
   - `index.html` đăng ký `/sw.js` (Caching SW).
   - Firebase SDK (`fcmService.ts`) mặc định sẽ thử đăng ký `/firebase-messaging-sw.js`.
   - **Hệ quả:** Trình duyệt có thể chỉ chạy 1 trong 2 SW trên cùng scope root (`/`), dẫn đến việc **Caching hoạt động nhưng Push không nhận được** (hoặc ngược lại).
   
2. **Logic FCM chưa hoàn thiện:**
   - Trong `fcmService.ts`, hàm `getToken` được gọi mà không truyền `serviceWorkerRegistration`. Điều này khiến Firebase tự tạo registration riêng cho `firebase-messaging-sw.js`, gây xung đột với `sw.js` hiện có.

3. **Backend Logic:**
   - Cloud Functions đang gửi message với payload có cả `notification` và `data` fields. Điều này tốt, nhưng cần đảm bảo SW xử lý đúng `onBackgroundMessage`.

### 7.3 Đề xuất cải thiện (Action Plan)
Để tính năng Web Push hoạt động ổn định, cần thực hiện:

1. **Merge Service Workers:**
   - Tích hợp code từ `firebase-messaging-sw.js` vào `sw.js`.
   - Chỉ đăng ký duy nhất `sw.js` trong `index.html`.
   - Cập nhật `fcmService.ts` để sử dụng SW registration đã có:
     ```typescript
     const registration = await navigator.serviceWorker.ready;
     const token = await getToken(messaging, { 
       vapidKey: VAPID_KEY,
       serviceWorkerRegistration: registration 
     });
     ```

2. **Kiểm tra UX xin quyền:**
   - Hiện tại `App.tsx` xin quyền ngay khi load app (`Notification.requestPermission()`). Nên chuyển sang kích hoạt bằng hành động người dùng (nút "Bật thông báo") để tránh bị chặn tự động bởi trình duyệt.

3. **Xử lý Click thông báo:**
   - `sw.js` (hoặc `firebase-messaging-sw.js`) cần xử lý sự kiện `notificationclick` để focus vào tab đang mở thay vì luôn mở cửa sổ mới (đã có code xử lý này trong `firebase-messaging-sw.js` nhưng cần đảm bảo nó được chạy).

