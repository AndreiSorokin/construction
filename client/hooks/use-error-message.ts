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
      "\u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430",
    );
  }, []);

  const clearError = useCallback(() => setErrorMessage(""), []);

  return {
    errorMessage,
    showError,
    clearError,
  };
}
