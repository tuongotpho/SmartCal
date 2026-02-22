"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyPushReminder = exports.pushTaskReminder = exports.realtimeTaskReminder = exports.dailyTaskReminder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
// Hàm gửi tin nhắn qua Telegram
const sendToTelegram = async (config, message) => {
    try {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        await axios_1.default.post(url, {
            chat_id: config.chatId,
            text: message,
            parse_mode: "HTML",
        });
        console.log(`Sent to ${config.chatId}: Success`);
    }
    catch (error) {
        console.error(`Error sending to ${config.chatId}:`, error);
    }
};
/**
 * 1. DAILY REMINDER: Chạy vào 6:00 AM mỗi ngày
 * Tổng hợp toàn bộ công việc trong ngày
 */
exports.dailyTaskReminder = functions.pubsub
    .schedule("0 6 * * *")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async (context) => {
    const now = new Date();
    const timeZone = "Asia/Ho_Chi_Minh";
    const zonedDate = (0, date_fns_tz_1.utcToZonedTime)(now, timeZone);
    const todayStr = (0, date_fns_1.format)(zonedDate, "yyyy-MM-dd");
    console.log(`[Daily] Bắt đầu quét công việc cho ngày: ${todayStr}`);
    const tasksSnapshot = await db
        .collection("tasks")
        .where("date", "==", todayStr)
        .where("completed", "==", false)
        .get();
    if (tasksSnapshot.empty)
        return null;
    const userTasksMap = {};
    tasksSnapshot.forEach((doc) => {
        const task = doc.data();
        if (task.userId) {
            if (!userTasksMap[task.userId])
                userTasksMap[task.userId] = [];
            userTasksMap[task.userId].push(task);
        }
    });
    for (const userId of Object.keys(userTasksMap)) {
        const tasks = userTasksMap[userId];
        const configDoc = await db.doc(`users/${userId}/config/telegram`).get();
        if (!configDoc.exists)
            continue;
        const config = configDoc.data();
        if (!config.botToken || !config.chatId)
            continue;
        let message = `🌅 <b>Chào buổi sáng!</b>\n\nHôm nay (${todayStr}) bạn có <b>${tasks.length}</b> công việc cần làm:\n\n`;
        tasks.sort((a, b) => a.time.localeCompare(b.time));
        tasks.forEach((t) => { message += `⏰ <b>${t.time}</b>: ${t.title}\n`; });
        message += `\n<i>Chúc bạn một ngày hiệu quả!</i> 💪`;
        await sendToTelegram(config, message);
    }
    return null;
});
/**
 * 2. REALTIME REMINDER: Chạy mỗi 5 phút
 * Kiểm tra các task sắp đến giờ (trong vòng 30 phút tới)
 */
exports.realtimeTaskReminder = functions.pubsub
    .schedule("*/5 * * * *") // Chạy mỗi 5 phút
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async (context) => {
    const now = new Date();
    const timeZone = "Asia/Ho_Chi_Minh";
    const zonedDate = (0, date_fns_tz_1.utcToZonedTime)(now, timeZone);
    const todayStr = (0, date_fns_1.format)(zonedDate, "yyyy-MM-dd");
    // Tính phút hiện tại trong ngày (0 - 1439)
    const currentHours = parseInt((0, date_fns_1.format)(zonedDate, "HH"), 10);
    const currentMinutes = parseInt((0, date_fns_1.format)(zonedDate, "mm"), 10);
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    console.log(`[Realtime] Quét lúc ${(0, date_fns_1.format)(zonedDate, "HH:mm")} (${todayStr})`);
    // Lấy các task hôm nay chưa hoàn thành
    // Lưu ý: Không dùng .where("reminderSent", "==", false) vì Firestore không match undefined với false
    // Sẽ filter trong code để không bỏ sót tasks cũ (chưa có field reminderSent)
    const tasksSnapshot = await db
        .collection("tasks")
        .where("date", "==", todayStr)
        .where("completed", "==", false)
        .get();
    if (tasksSnapshot.empty)
        return null;
    const batch = db.batch(); // Dùng batch để update Firestore hiệu quả
    let hasUpdates = false;
    // Duyệt qua từng task để kiểm tra giờ
    for (const doc of tasksSnapshot.docs) {
        const task = doc.data();
        const taskId = doc.id;
        if (!task.time || !task.userId)
            continue;
        // Bỏ qua nếu đã gửi nhắc nhở (reminderSent === true)
        // Lưu ý: task.reminderSent có thể undefined (task cũ), coi như chưa gửi
        if (task.reminderSent === true)
            continue;
        // Parse giờ task
        const [h, m] = task.time.split(":").map(Number);
        const taskTotalMinutes = h * 60 + m;
        const diff = taskTotalMinutes - currentTotalMinutes;
        // Logic: Nhắc nhở nếu công việc diễn ra trong 30 phút tới 
        // HOẶC đã quá giờ không quá 15 phút (đề phòng cron chạy trễ)
        if (diff <= 30 && diff >= -15) {
            // Lấy config Telegram của user
            const configDoc = await db.doc(`users/${task.userId}/config/telegram`).get();
            if (configDoc.exists) {
                const config = configDoc.data();
                if (config.botToken && config.chatId) {
                    const msg = `🚨 <b>SẮP ĐẾN HẠN!</b>\n\n📌 <b>${task.title}</b>\n⏰ Thời gian: ${task.time}\n\n👉 <i>Hãy kiểm tra ngay!</i>`;
                    await sendToTelegram(config, msg);
                    // Đánh dấu đã gửi để không gửi lại
                    const taskRef = db.collection("tasks").doc(taskId);
                    batch.update(taskRef, { reminderSent: true });
                    hasUpdates = true;
                    console.log(`Sent reminder for task ${taskId}`);
                }
            }
        }
    }
    if (hasUpdates) {
        await batch.commit();
        console.log("Đã cập nhật trạng thái reminderSent cho các task.");
    }
    return null;
});
/**
 * 3. WEB PUSH REMINDER: Gửi FCM Push Notification
 * Chạy cùng lúc với Telegram reminder
 */
exports.pushTaskReminder = functions.pubsub
    .schedule("*/5 * * * *") // Chạy mỗi 5 phút
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async (context) => {
    const now = new Date();
    const timeZone = "Asia/Ho_Chi_Minh";
    const zonedDate = (0, date_fns_tz_1.utcToZonedTime)(now, timeZone);
    const todayStr = (0, date_fns_1.format)(zonedDate, "yyyy-MM-dd");
    const currentHours = parseInt((0, date_fns_1.format)(zonedDate, "HH"), 10);
    const currentMinutes = parseInt((0, date_fns_1.format)(zonedDate, "mm"), 10);
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    console.log(`[Push] Quét lúc ${(0, date_fns_1.format)(zonedDate, "HH:mm")} (${todayStr})`);
    // Lấy các task hôm nay chưa hoàn thành và chưa gửi push
    const tasksSnapshot = await db
        .collection("tasks")
        .where("date", "==", todayStr)
        .where("completed", "==", false)
        .get();
    if (tasksSnapshot.empty)
        return null;
    const batch = db.batch();
    let hasUpdates = false;
    for (const doc of tasksSnapshot.docs) {
        const task = doc.data();
        const taskId = doc.id;
        if (!task.time || !task.userId)
            continue;
        // Bỏ qua nếu đã gửi push (pushSent === true)
        if (task.pushSent === true)
            continue;
        const [h, m] = task.time.split(":").map(Number);
        const taskTotalMinutes = h * 60 + m;
        const diff = taskTotalMinutes - currentTotalMinutes;
        // Nhắc trong vòng 30 phút hoặc quá giờ không quá 15 phút
        if (diff <= 30 && diff >= -15) {
            // Lấy FCM token của user
            const fcmDoc = await db.doc(`users/${task.userId}/config/fcm`).get();
            if (fcmDoc.exists) {
                const fcmData = fcmDoc.data();
                const fcmToken = fcmData === null || fcmData === void 0 ? void 0 : fcmData.token;
                if (fcmToken) {
                    try {
                        // Gửi FCM Push Notification
                        await messaging.send({
                            token: fcmToken,
                            data: {
                                taskId: taskId,
                                type: 'TASK_REMINDER',
                                url: '/',
                                title: `🔔 ${task.title}`,
                                body: `${task.time} - ${diff > 0 ? `Còn ${diff} phút` : 'Đã đến giờ!'}`
                            },
                            android: {
                                notification: {
                                    icon: 'icon',
                                    color: '#f97316',
                                    sound: 'default',
                                    priority: 'high',
                                    channelId: 'smartcal-reminders'
                                }
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'default',
                                        badge: 1,
                                        contentAvailable: true
                                    }
                                }
                            },
                            webpush: {
                                fcmOptions: {
                                    link: '/'
                                }
                            }
                        });
                        // Đánh dấu đã gửi push
                        const taskRef = db.collection("tasks").doc(taskId);
                        batch.update(taskRef, { pushSent: true });
                        hasUpdates = true;
                        console.log(`[Push] Sent to ${fcmToken.substring(0, 20)}... for task ${taskId}`);
                    }
                    catch (error) {
                        console.error(`[Push] Error sending to token:`, error.message);
                        // Nếu token không hợp lệ, xóa khỏi Firestore
                        if (error.code === 'messaging/registration-token-not-registered' ||
                            error.code === 'messaging/invalid-registration-token') {
                            await db.doc(`users/${task.userId}/config/fcm`).delete();
                            console.log(`[Push] Deleted invalid token for user ${task.userId}`);
                        }
                    }
                }
            }
        }
    }
    if (hasUpdates) {
        await batch.commit();
        console.log("[Push] Đã cập nhật trạng thái pushSent cho các task.");
    }
    return null;
});
/**
 * 4. DAILY PUSH REMINDER: Tổng hợp công việc buổi sáng qua Push
 */
exports.dailyPushReminder = functions.pubsub
    .schedule("0 6 * * *")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async (context) => {
    var _a;
    const now = new Date();
    const timeZone = "Asia/Ho_Chi_Minh";
    const zonedDate = (0, date_fns_tz_1.utcToZonedTime)(now, timeZone);
    const todayStr = (0, date_fns_1.format)(zonedDate, "yyyy-MM-dd");
    console.log(`[DailyPush] Bắt đầu quét cho ngày: ${todayStr}`);
    const tasksSnapshot = await db
        .collection("tasks")
        .where("date", "==", todayStr)
        .where("completed", "==", false)
        .get();
    if (tasksSnapshot.empty)
        return null;
    const userTasksMap = {};
    tasksSnapshot.forEach((doc) => {
        const task = doc.data();
        if (task.userId) {
            if (!userTasksMap[task.userId])
                userTasksMap[task.userId] = [];
            userTasksMap[task.userId].push(task);
        }
    });
    for (const userId of Object.keys(userTasksMap)) {
        const tasks = userTasksMap[userId];
        // Lấy FCM token
        const fcmDoc = await db.doc(`users/${userId}/config/fcm`).get();
        if (!fcmDoc.exists)
            continue;
        const fcmToken = (_a = fcmDoc.data()) === null || _a === void 0 ? void 0 : _a.token;
        if (!fcmToken)
            continue;
        try {
            const taskCount = tasks.length;
            const nextTask = tasks.sort((a, b) => a.time.localeCompare(b.time))[0];
            await messaging.send({
                token: fcmToken,
                data: {
                    type: 'DAILY_SUMMARY',
                    url: '/',
                    title: `🌅 Chào buổi sáng!`,
                    body: `Hôm nay bạn có ${taskCount} công việc. Đầu tiên: ${nextTask.title} lúc ${nextTask.time}`
                },
                android: {
                    notification: {
                        icon: 'icon',
                        color: '#f97316',
                        sound: 'default'
                    }
                }
            });
            console.log(`[DailyPush] Sent summary to user ${userId}`);
        }
        catch (error) {
            console.error(`[DailyPush] Error:`, error.message);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map