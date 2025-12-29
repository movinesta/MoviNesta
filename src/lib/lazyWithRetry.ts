import { safeSessionStorageGetItem, safeSessionStorageRemoveItem, safeSessionStorageSetItem } from "@/lib/storage";
import React from "react";

const RETRY_FLAG = "movinesta:lazy-retry";

const isChunkLoadError = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  return /ChunkLoadError|Loading chunk [\d]+ failed|dynamically imported module/i.test(
    error.message,
  );
};

export const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) => {
  return React.lazy(async () => {
    const hasRetried = safeSessionStorageGetItem(RETRY_FLAG) === "true";

    try {
      const module = await factory();

      if (hasRetried) {
        safeSessionStorageRemoveItem(RETRY_FLAG);
      }

      return module;
    } catch (error) {
      if (!hasRetried && isChunkLoadError(error)) {
        safeSessionStorageSetItem(RETRY_FLAG, "true");
        window.location.reload();
      }

      throw error;
    }
  });
};
