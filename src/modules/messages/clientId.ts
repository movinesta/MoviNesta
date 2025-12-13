export const createClientId = (fallback: () => string = () => String(Date.now())): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallback();
};
