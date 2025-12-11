
export type RecurringType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Tag {
  name: string;
  color: string; // Tailwind classes string (bg-..., border-..., text-...)
  dot: string;   // Tailwind class for dot color
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  date: string; // Format: YYYY-MM-DD (Ngày bắt đầu)
  endDate?: string; // Format: YYYY-MM-DD (Ngày kết thúc - New)
  time: string; // Format: HH:mm
  description?: string;
  completed: boolean;
  reminderSent?: boolean;
  recurringType?: RecurringType;
  isRecurring?: boolean; // Deprecated
  tag?: string; // Tên thẻ (VD: Công việc, Gia đình)
  color?: string; // Deprecated in favor of tag lookup
  subtasks?: Subtask[]; // Danh sách công việc con
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export enum ViewMode {
  MONTH = 'MONTH',
  WEEK = 'WEEK',
  DAY = 'DAY',
  LIST = 'LIST',
  STATS = 'STATS'
}

export const COLOR_PALETTES: Record<string, { color: string, dot: string, label: string }> = {
  Red: { color: 'bg-red-100 border-red-300 text-red-800', dot: 'bg-red-500', label: 'Đỏ' },
  Orange: { color: 'bg-orange-100 border-orange-300 text-orange-800', dot: 'bg-orange-500', label: 'Cam' },
  Amber: { color: 'bg-amber-100 border-amber-300 text-amber-800', dot: 'bg-amber-500', label: 'Vàng đất' },
  Yellow: { color: 'bg-yellow-100 border-yellow-300 text-yellow-800', dot: 'bg-yellow-500', label: 'Vàng' },
  Green: { color: 'bg-green-100 border-green-300 text-green-800', dot: 'bg-green-500', label: 'Xanh lá' },
  Emerald: { color: 'bg-emerald-100 border-emerald-300 text-emerald-800', dot: 'bg-emerald-500', label: 'Ngọc lục bảo' },
  Teal: { color: 'bg-teal-100 border-teal-300 text-teal-800', dot: 'bg-teal-500', label: 'Xanh ngọc' },
  Cyan: { color: 'bg-cyan-100 border-cyan-300 text-cyan-800', dot: 'bg-cyan-500', label: 'Xanh lơ' },
  Blue: { color: 'bg-blue-100 border-blue-300 text-blue-800', dot: 'bg-blue-500', label: 'Xanh dương' },
  Indigo: { color: 'bg-indigo-100 border-indigo-300 text-indigo-800', dot: 'bg-indigo-500', label: 'Chàm' },
  Violet: { color: 'bg-violet-100 border-violet-300 text-violet-800', dot: 'bg-violet-500', label: 'Tím' },
  Purple: { color: 'bg-purple-100 border-purple-300 text-purple-800', dot: 'bg-purple-500', label: 'Tím Huế' },
  Fuchsia: { color: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800', dot: 'bg-fuchsia-500', label: 'Hồng cánh sen' },
  Pink: { color: 'bg-pink-100 border-pink-300 text-pink-800', dot: 'bg-pink-500', label: 'Hồng' },
  Rose: { color: 'bg-rose-100 border-rose-300 text-rose-800', dot: 'bg-rose-500', label: 'Hồng đỏ' },
  Gray: { color: 'bg-gray-100 border-gray-300 text-gray-800', dot: 'bg-gray-500', label: 'Xám' },
};

export const DEFAULT_TASK_TAGS: Tag[] = [
  { name: 'Công việc', ...COLOR_PALETTES.Red },
  { name: 'Gia đình', ...COLOR_PALETTES.Blue },
  { name: 'Sức khỏe', ...COLOR_PALETTES.Green },
  { name: 'Học tập', ...COLOR_PALETTES.Purple },
  { name: 'Giải trí', ...COLOR_PALETTES.Yellow },
  { name: 'Khác', ...COLOR_PALETTES.Gray },
];
