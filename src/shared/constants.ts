// Timezone and locale constants
export const APP_TIMEZONE = 'Asia/Tokyo'; // JST
export const APP_LOCALE = 'ja-JP';

// JST is UTC+9, so:
// 10:00 JST = 01:00 UTC
// 22:00 JST = 13:00 UTC
export const MORNING_SUMMARY_HOUR_UTC = 1; // 10:00 JST
export const EVENING_SUMMARY_HOUR_UTC = 13; // 22:00 JST

// Default reminder settings
export const DEFAULT_REMINDER_MINUTES_BEFORE = 15;
export const DEFAULT_AUTO_REMINDERS_ENABLED = true;
export const DEFAULT_DAILY_SUMMARY_ENABLED = true;
