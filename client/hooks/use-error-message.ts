"use client";

import { useCallback, useEffect, useState } from "react";

const MESSAGE_TIMEOUT_MS = 5000;

export function useErrorMessage() {
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage("");
    }, MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage]);

  const showError = useCallback((error: unknown) => {
    if (typeof error === "string") {
      setErrorMessage(error);
      return;
    }

    if (error instanceof Error) {
      setErrorMessage(error.message);
      return;
    }

    setErrorMessage(
      "Произошла ошибка",
    );
  }, []);

  const clearError = useCallback(() => setErrorMessage(""), []);

  return {
    errorMessage,
    showError,
    clearError,
  };
}
