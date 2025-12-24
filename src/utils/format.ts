const getLocale = () =>
  typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export const formatDate = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
) => new Intl.DateTimeFormat(getLocale(), options).format(toDate(value));

export const formatTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
) => new Intl.DateTimeFormat(getLocale(), options).format(toDate(value));

export const formatDateTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) => new Intl.DateTimeFormat(getLocale(), options).format(toDate(value));

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLocale(), options).format(value);
