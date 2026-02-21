import { Task } from '../types';
import { getGoogleAccessToken } from './firebase';

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
    id?: string;
    htmlLink?: string;
}

const buildEventFromTask = (task: Task): GoogleEvent => {
    // Parsing thời gian từ task (ví dụ: task.date="2023-12-01", task.time="14:30")
    const startTime = new Date(`${task.date}T${task.time}:00`);

    // Tạm thời mặc định sự kiện kéo dài 1 tiếng
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    // Lấy timezone hiện tại của trình duyệt
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
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
};

export const addEventToGoogleCalendarAPI = async (task: Task): Promise<GoogleEvent | null> => {
    const token = getGoogleAccessToken();
    if (!token) {
        throw new Error('missing_token');
    }

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
