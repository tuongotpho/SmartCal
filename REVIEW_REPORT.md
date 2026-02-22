# 📊 BÁO CÁO RÀ SOÁT TỔNG THỂ CODEBASE SMARTCAL PRO

**Ngày rà soát:** 22/02/2026
**Người rà soát:** AI Assistant
**Mục tiêu:** Rà soát toàn bộ dự án từ Frontend đến Backend, đánh giá ưu nhược điểm, và lên roadmap phát triển.

---

## 1. TỔNG QUAN KIẾN TRÚC & TECH STACK

SmartCal Pro đã phát triển vượt bậc từ một ứng dụng lịch đơn giản thành một **Hệ sinh thái Quản lý năng suất (Productivity Hub)** đa nền tảng, kết hợp AI tiên tiến.

### 1.1 Tech Stack Hiện Tại
*   **Web Frontend:** React 18, Vite, TypeScript.
*   **Desktop App Wrapper:** Tauri (Rust-based) cực kỳ nhẹ và nhanh.
*   **Giao diện (UI/UX):** Tailwind CSS, Lucide Icons, Hỗ trợ Multi-Theme (Cam, Tím, Xanh) và Dark Mode hoàn chỉnh.
*   **Backend & Cơ sở dữ liệu:** Firebase Firestore (NoSQL realtime), Firebase Authentication (Google/Email).
*   **Serverless Logic:** Firebase Cloud Functions (`functions/src/index.ts`).
*   **AI Integration:** `@google/genai` (Mô hình Gemini 2.0 Flash) tích hợp trực tiếp.
*   **Notification:** Trình duyệt Web Push, Telegram Bot API, Firebase Cloud Messaging (FCM).
*   **Hosting & Domain:** Firebase Hosting, cấu hình PWA (Progressive Web App), đã xác minh Google Search Console.

---

## 2. DANH SÁCH TÍNH NĂNG ĐÃ HOÀN THIỆN (Hệ sinh thái hiện tại)

### 🤖 2.1 AI & Tự động hóa
1.  **AI Smart Entry (Lên lịch bằng văn bản tự nhiên):** Gõ "Trưa mai đi ăn phở", AI tự động bóc tách ngày, giờ, hành động và tạo Task.
2.  **Chatbot Trợ lý ảo:** Giao diện Chatbot mini ghim ở góc màn hình, giải đáp thắc mắc và hỗ trợ người dùng ngay trong app.
3.  **Báo cáo năng suất AI:** Tự động tổng hợp dữ liệu tuần/tháng và nhận xét bằng văn bản dựa trên trí tuệ nhân tạo.

### 📅 2.2 Quản lý Lịch trình & Công việc
1.  **Chế độ xem đa dạng:** Calendar (Tháng/Tuần/Ngày), Danh sách (List), Timeline (Dòng thời gian dọc), Kanban Board (Kéo thả trạng thái).
2.  **Focus Mode:** Tích hợp đồng hồ Pomodoro ngay trong app, có âm thanh haptic (Tiếng rung/chuông) khi hết giờ.
3.  **Thống kê (Stats):** Biểu đồ trực quan hóa số lượng công việc hoàn thành, biểu đồ Heatmap thói quen.
4.  **Cảnh báo Xung đột:** Tự động phát hiện nếu bạn xếp 2 công việc trùng một khung giờ và bật Modal cảnh báo.
5.  **Offline-first:** LocalStorage caching cho phép xem và sửa lịch ngay cả khi rớt mạng, tự động đồng bộ khi có mạng lại.
6.  **Hệ thống Tagging:** Phân loại công việc bằng hệ màu sắc (VD: #Work, #Personal, #Urgent).

### 🔔 2.3 Hệ thống Nhắc nhở Đa kênh
1.  **Nhắc nhở Telegram Bot:** Người dùng nhập ChatID, hệ thống tự động bắn tin nhắn nhắc việc qua Telegram vào sáng sớm hoặc sát giờ.
2.  **Web Push Notifications:** Thông báo nhảy trực tiếp trên hệ điều hành máy tính/điện thoại thông qua FCM.
3.  **Tùy biến thời gian nhắc:** Cho phép thiết lập nhắc trước 5 phút, 15 phút, 1 tiếng,...

### 🔄 2.4 Đồng bộ & Tài khoản
1.  **Đăng nhập bảo mật:** Xác thực qua Firebase Auth (Email/Password, Google).
2.  **Đồng bộ Google Calendar (1-chiều):** Khi tạo/sửa/xóa task trên App, dữ liệu tự động đẩy mượt mà lên Google Calendar chính thức của User.
3.  **Onboarding 4 Bước:** Modal Carousel cực đẹp và trực quan giới thiệu các "Tính năng ăn tiền" cho User mới đăng nhập lần đầu.

---

## 3. ĐÁNH GIÁ: ƯU & NHƯỢC ĐIỂM

### ✅ 3.1 Điểm Mạnh (PROS)
1.  **UI/UX Vượt Trội:** Thiết kế mang hơi hướng Apple/Notion, rất trau chuốt từ border-radius, shadow, đến các micro-animations (như hiệu ứng khi click Hoàn thành). Onboarding flow rất bài bản.
2.  **Tính thực dụng cực cao:** Giải quyết đúng "nỗi đau" của người dùng lịch: Lười nhập liệu (Có AI), hay quên (Có Telegram nhắc), rối rắm (Có Onboarding hướng dẫn).
3.  **Multi-Platform:** Vừa chạy mượt trên Web/Mobile Browser, vừa có bản build `.exe` siêu nhẹ bằng Tauri cho Desktop.
4.  **Kiến trúc File Service rõ ràng:** Việc tách riêng `geminiService.ts`, `googleCalendarApiService.ts`, `telegramService.ts` cho thấy tư duy code sạch, dễ bảo trì.

### ❌ 3.2 Điểm Yếu & Rủi ro Kỹ thuật (CONS)
1.  **"God Component" - App.tsx quá "mập":** File `App.tsx` có dung lượng cực lớn (chứa quá nhiều State và Logic render). Việc này sẽ gây khó khăn khi scale app lớn hơn và làm chậm quá trình render (Re-render hàng loạt tài nguyên).
2.  **Bảo mật API Key ở Client:** Key Gemini và Key Firebase đang nằm trực tiếp ở phía Frontend (Client-side). Bất kỳ ai mở F12 cũng có thể lấy trộm Key API của bạn.
3.  **Google Calendar Sync chỉ là 1-chiều:** Dù đã cập nhật wording cho User, nhưng việc không kéo được lịch từ Google gốc về App (Pull) khiến trải nghiệm chưa trọn vẹn 100%.
4.  **Rác Database từ tài khoản ảo:** Khi người dùng xóa tài khoản (Delete Account) hoặc bỏ app, dữ liệu rác trên Firestore không tự biến mất.
5.  **Chưa có State Manager chuyên dụng:** Việc quản lý `tasks` array qua Hook state ở App component và truyền Props xuống Kanban/Calendar sẽ gây "Props Drilling" (Nhồi props qua nhiều tầng).

---

## 4. GỢI Ý NÂNG CẤP & CẢI THIỆN CODEBASE

### 🛠 4.1 Refactor Kiến trúc (Cải thiện Code)
1.  **Sử dụng Global State (Zustand hoặc Redux Toolkit):** Chuyển toàn bộ biến state như `tasks`, `tags`, `settings`, `theme` ra một file Store riêng (VD: `useTaskStore.ts`). File `App.tsx` chỉ làm nhiệm vụ Route và Layout.
2.  **Tách nhỏ App.tsx:** Tách phần logic Auth (Đăng nhập), Modal quản lý (Các popup) ra thành các Component Wrapper riêng (`<AuthWrapper>`, `<ModalManager>`).
3.  **Tối ưu Re-render (Performance):** Sử dụng `React.memo` kỹ lưỡng hơn cho các cấu phần nặng như `CalendarView` hay `KanbanView` để khi sửa 1 thẻ task không làm giật cả bảng.
4.  **Bảo mật biến môi trường:** Cần cấu hình `.env` chặt chẽ, và đối với Cloud Functions thì dùng Firebase Secrets Manager để lưu các Token nhạy cảm.

### 📡 4.2 Nâng cấp Dịch vụ (Backend / Automation)
1.  **Firebase Webhook cho Google Calendar (2-Way Sync):** Viết thêm một Cloud Function để hứng sự kiện (Webhook Notification) từ Google Calendar. Khi user sửa lịch trên điện thoại bằng app Google, Firebase sẽ nhận thông báo và cập nhật ngược lại vào Firestore.
2.  **Cài đặt Firebase Extensions (Như đã tư vấn):**
    *   Cài ngay `Delete User Data` để xóa sạch dữ liệu Firestore khi Auth User bị xóa.
    *   Cài `Trigger Email from Firestore` để xử lý hệ thống Email thông báo.
3.  **Gộp Service Workers:** Hiện tại PWA có `sw.js` và Firebase có `firebase-messaging-sw.js`. Cần dùng `importScripts` để gộp 2 file này lại giải quyết triệt để lỗi Push Notification lúc được lúc không.

---

## 5. TÍNH NĂNG MỚI ĐỀ XUẤT CHO VER 4.0 (Tương lai)

1.  **Lịch Sinh Sinh Học (BioRhythm / Energy Tracker):** AI gợi ý xếp những công việc khó vào khung giờ "Năng lượng cao" của người dùng.
2.  **Chế độ Đội nhóm (Team Collaboration):** Cho phép Share một Task hoặc Share cả một Project Kanban cho tài khoản khác để làm việc chung.
3.  **Lặp công việc nâng cao (Advanced Recurring Rules):** Hiện tại chỉ lặp cơ bản. Có thể làm lặp theo kiểu "Ngày thứ Cum cuối cùng của tháng" hoặc "Các thứ 3 và thứ 5 hàng tuần".
4.  **Webhooks & API Public:** Mở API cho phép người dùng tự dùng Zapier/IFTTT hoặc phím tắt iOS (Shortcuts) để bắn việc vào SmartCal.
5.  **Lịch Âm (Lunar Calendar):** Tích hợp sâu hiển thị ngày Âm lịch dưới ngày Dương lịch trên giao diện Tháng (rất cần thiết cho User Việt Nam).

---
*Báo cáo được thực hiện bằng quy trình quét code tự động toàn bộ Workspace.*
*Mọi thay đổi có thể được tiến hành triển khai theo từng Phase nếu bạn đồng ý.*
