export const minutesFromNow = (minutes: number, now = new Date()) =>
  new Date(now.getTime() + minutes * 60 * 1000);

export const daysFromNow = (days: number, now = new Date()) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
