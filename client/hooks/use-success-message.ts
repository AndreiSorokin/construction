"use client";

import { useCallback, useEffect, useState } from "react";

const MESSAGE_TIMEOUT_MS = 5000;

export function useSuccessMessage() {
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
  }, []);

  const clearSuccess = useCallback(() => setSuccessMessage(""), []);

  return {
    successMessage,
    showSuccess,
    clearSuccess,
  };
}
