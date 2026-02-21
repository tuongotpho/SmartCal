/**
 * Lunar Calendar Service - Chuyển đổi Âm Lịch ↔ Dương Lịch (Việt Nam)
 * Thuật toán dựa trên công trình của Hồ Ngọc Đức.
 * Hỗ trợ: 1900 - 2100
 */

const PI = Math.PI;

// Julian Day Number từ ngày Dương lịch
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

// Ngày Dương lịch từ Julian Day Number
function jdToDate(jd: number): [number, number, number] {
  let a: number, b: number, c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

function SunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * Math.floor(L / (PI * 2));
  return L;
}

function NewMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Jd1 + C1 - deltat;
}

function getSunLongitude(jdn: number, timeZone: number): number {
  return Math.floor((SunLongitude(jdn - 0.5 - timeZone / 24) / PI) * 6);
}

function getNewMoonDay(k: number, timeZone: number): number {
  return Math.floor(NewMoon(k) + 0.5 + timeZone / 24);
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  let k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021.076998695;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

// ==============================
// PUBLIC API
// ==============================

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  isLeapMonth: boolean;
}

export interface SolarDate {
  day: number;
  month: number;
  year: number;
}

const TIMEZONE = 7; // GMT+7 Vietnam

const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];

/**
 * Chuyển Dương lịch → Âm lịch
 */
export function solarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, TIMEZONE);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, TIMEZONE);
  }
  let a11 = getLunarMonth11(yy, TIMEZONE);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, TIMEZONE);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, TIMEZONE);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, TIMEZONE);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth: lunarLeap };
}

/**
 * Chuyển Âm lịch → Dương lịch
 */
export function lunarToSolar(lunarDay: number, lunarMonth: number, lunarYear: number, lunarLeap: boolean = false): SolarDate {
  let a11: number, b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, TIMEZONE);
    b11 = getLunarMonth11(lunarYear, TIMEZONE);
  } else {
    a11 = getLunarMonth11(lunarYear, TIMEZONE);
    b11 = getLunarMonth11(lunarYear + 1, TIMEZONE);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, TIMEZONE);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) {
      leapMonth += 12;
    }
    if (lunarLeap && lunarMonth !== leapMonth) {
      return { day: 0, month: 0, year: 0 }; // Invalid
    } else if (lunarLeap || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, TIMEZONE);
  const [day, month, year] = jdToDate(monthStart + lunarDay - 1);
  return { day, month, year };
}

/**
 * Lấy ngày Âm lịch từ Date object (backward-compatible với phiên bản cũ)
 */
export const getLunarDate = (date: Date): { lunarDate: string; lunarCanChi: string } => {
  const lunar = solarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear());
  const can = CAN[(lunar.year - 4) % 10];
  const chi = CHI[(lunar.year - 4) % 12];
  return {
    lunarDate: `${lunar.day}/${lunar.month}${lunar.isLeapMonth ? ' (Nhuận)' : ''}`,
    lunarCanChi: `Năm ${can} ${chi}`
  };
};

/**
 * Format ngày Âm lịch đẹp
 */
export function formatLunarDate(lunar: LunarDate): string {
  return `${lunar.day}/${lunar.month}${lunar.isLeapMonth ? ' (nhuận)' : ''} Âm lịch`;
}

/**
 * Lấy ngày Dương lịch cho sự kiện Âm lịch lặp hàng năm
 * (ví dụ: ngày giỗ 15/7 Âm → trả về ngày Dương cho năm targetYear)
 */
export function getLunarAnniversarySolar(lunarDay: number, lunarMonth: number, targetSolarYear: number): SolarDate {
  // Thử chuyển đổi cho năm Âm = targetSolarYear
  let result = lunarToSolar(lunarDay, lunarMonth, targetSolarYear, false);

  // Nếu ngày Dương ra năm sai (do lệch lịch), thử năm kế
  if (result.year !== targetSolarYear) {
    const alt = lunarToSolar(lunarDay, lunarMonth, targetSolarYear - 1, false);
    if (alt.year === targetSolarYear) result = alt;
  }

  return result;
}