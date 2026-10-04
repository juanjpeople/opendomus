export const DAY = 86_400_000;
export const INACTIVITY_PAUSE_DAYS = 90;
export const INACTIVITY_NOTICE_DAYS = [30, 7, 1] as const;

export function inactivityNoticeWindow(daysBeforePause: (typeof INACTIVITY_NOTICE_DAYS)[number], index: number, now: number) {
  const nextDaysBeforePause = INACTIVITY_NOTICE_DAYS[index + 1] ?? 0;
  return {
    dueAtOffset: (INACTIVITY_PAUSE_DAYS - daysBeforePause) * DAY,
    activeBefore: now - (INACTIVITY_PAUSE_DAYS - daysBeforePause) * DAY,
    activeAfter: now - (INACTIVITY_PAUSE_DAYS - nextDaysBeforePause) * DAY,
  };
}

export const inactiveBefore = (now: number) => now - INACTIVITY_PAUSE_DAYS * DAY;
