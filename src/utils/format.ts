const getLocale = () =>
  typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";

const toDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
) => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};

export const formatTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
) => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};

export const formatDateTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLocale(), options).format(value);
