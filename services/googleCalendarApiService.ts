import { Task } from '../types';
import { getGoogleAccessToken } from './firebase';
import { getLunarAnniversarySolar } from './lunarService';

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface GoogleEvent {
    summary: string;
    description?: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    recurrence?: string[];
    id?: string;
    htmlLink?: string;
}

/**
 * Map ngày trong tuần (JS 0=CN) sang RRULE BYDAY
 */
const BYDAY_MAP: Record<number, string> = {
    0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA'
};

/**
 * Build RRULE cho sự kiện Dương lịch lặp lại
 */
const buildRRule = (task: Task): string[] | undefined => {
    const recType = task.recurringType || 'none';
    if (recType === 'none') return undefined;

    // Không dùng RRULE cho sự kiện Âm lịch (xử lý riêng bằng multi-event)
    if (task.isLunarDate) return undefined;

    const startDate = new Date(`${task.date}T${task.time || '00:00'}:00`);

    switch (recType) {
        case 'daily':
            return ['RRULE:FREQ=DAILY'];
        case 'weekly': {
            const dayOfWeek = BYDAY_MAP[startDate.getDay()];
            return [`RRULE:FREQ=WEEKLY;BYDAY=${dayOfWeek}`];
        }
        case 'monthly': {
            const dayOfMonth = startDate.getDate();
            return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`];
        }
        case 'yearly': {
            const month = startDate.getMonth() + 1;
            const day = startDate.getDate();
            return [`RRULE:FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`];
        }
        default:
            return undefined;
    }
};

const buildEventFromTask = (task: Task, overrideDate?: string): GoogleEvent => {
    const dateStr = overrideDate || task.date;
    const startTime = new Date(`${dateStr}T${task.time || '00:00'}:00`);

    // Mặc định sự kiện kéo dài 1 tiếng
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    // Lấy timezone hiện tại của trình duyệt
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const event: GoogleEvent = {
        summary: task.title,
        description: task.description || "",
        start: {
            dateTime: startTime.toISOString(),
            timeZone
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone
        }
    };

    // Thêm RRULE cho sự kiện Dương lịch lặp lại
    const recurrence = buildRRule(task);
    if (recurrence && !overrideDate) {
        event.recurrence = recurrence;
    }

    return event;
};

/**
 * Tạo event mới trên Google Calendar.
 * - Dương lịch lặp lại: 1 event + RRULE
 * - Âm lịch lặp lại: tạo 10 event riêng lẻ cho 10 năm tới
 */
export const addEventToGoogleCalendarAPI = async (task: Task): Promise<GoogleEvent | null> => {
    const token = getGoogleAccessToken();
    if (!token) {
        throw new Error('missing_token');
    }

    // --- ÂM LỊCH LẶP LẠI: Tạo 10 event riêng lẻ ---
    if (task.isLunarDate && task.lunarDay && task.lunarMonth &&
        (task.recurringType === 'yearly' || task.recurringType === 'monthly')) {

        const YEARS_AHEAD = 10;
        const currentYear = new Date(task.date).getFullYear();
        let firstEvent: GoogleEvent | null = null;

        for (let i = 0; i < YEARS_AHEAD; i++) {
            const targetYear = currentYear + i;
            try {
                const solarDate = getLunarAnniversarySolar(task.lunarDay, task.lunarMonth, targetYear);
                if (solarDate.day === 0) continue;

                const dateStr = `${solarDate.year}-${String(solarDate.month).padStart(2, '0')}-${String(solarDate.day).padStart(2, '0')}`;

                // Thêm ghi chú Âm lịch vào mô tả
                const lunarDesc = `📅 Âm lịch: ${task.lunarDay}/${task.lunarMonth} (${targetYear})\n${task.description || ''}`;
                const lunarTask = { ...task, description: lunarDesc.trim() };
                const eventData = buildEventFromTask(lunarTask, dateStr);

                const response = await fetch(GOOGLE_CALENDAR_API_BASE, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(eventData)
                });

                if (response.status === 401 || response.status === 403) {
                    throw new Error('unauthorized');
                }

                if (response.ok) {
                    const data: GoogleEvent = await response.json();
                    if (i === 0) firstEvent = data; // Lưu event đầu tiên
                    console.log(`GCal Lunar Event created: ${dateStr} (${task.lunarDay}/${task.lunarMonth} Âm năm ${targetYear})`);
                } else {
                    console.warn(`GCal Lunar Event failed for ${targetYear}:`, await response.text());
                }
            } catch (error: any) {
                if (error.message === 'unauthorized' || error.message === 'missing_token') throw error;
                console.warn(`Lunar event creation failed for year ${targetYear}:`, error);
            }
        }

        return firstEvent;
    }

    // --- DƯƠNG LỊCH (CÓ HOẶC KHÔNG LẶP LẠI): 1 event (kèm RRULE nếu lặp) ---
    const eventData = buildEventFromTask(task);

    try {
        const response = await fetch(GOOGLE_CALENDAR_API_BASE, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('unauthorized');
        }

        if (!response.ok) {
            const errTxt = await response.text();
            console.error("Google Calendar API Error:", errTxt);
            throw new Error('api_error');
        }

        const data: GoogleEvent = await response.json();
        return data;
    } catch (error: any) {
        if (error.message === 'unauthorized' || error.message === 'missing_token') {
            throw error;
        }
        console.error('Request failed:', error);
        throw new Error('network_error');
    }
};

export const updateEventInGoogleCalendarAPI = async (eventId: string, task: Task): Promise<GoogleEvent | null> => {
    const token = getGoogleAccessToken();
    if (!token) return null;

    const eventData = buildEventFromTask(task);

    try {
        const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/${eventId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) {
            console.error("Google Calendar Update Error:", await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Update Request failed:', error);
        return null;
    }
};

export const deleteEventFromGoogleCalendarAPI = async (eventId: string): Promise<boolean> => {
    const token = getGoogleAccessToken();
    if (!token) return false;

    try {
        const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error("Google Calendar Delete Error:", await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error('Delete Request failed:', error);
        return false;
    }
};

/**
 * Lấy các sự kiện Google Calendar đã thay đổi từ thời điểm lastSyncTime
 * Cần truyền singleEvents=true để nó bung các event lặp ra, hoặc đơn giản lấy sự kiện gốc
 */
export const fetchUpdatedGoogleEvents = async (lastSyncTime: string): Promise<any[]> => {
    const token = getGoogleAccessToken();
    if (!token) return [];

    try {
        const url = `${GOOGLE_CALENDAR_API_BASE}?updatedMin=${encodeURIComponent(lastSyncTime)}&showDeleted=true`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn("Failed to fetch updated GCal events:", await response.text());
            return [];
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('Fetch updated events failed:', error);
        return [];
    }
};
