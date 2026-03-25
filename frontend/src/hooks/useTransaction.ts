"use client";

import { useState, useCallback } from "react";
import { sendTransaction, waitForTransaction, type FclArgFn } from "@/lib/fcl";

export type TxStatus = "idle" | "pending" | "sealed" | "error";

export function useTransaction() {
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txID, setTxID] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (code: string, args: FclArgFn): Promise<string> => {
    setStatus("pending");
    setTxID(null);
    setError(null);

    try {
      const id = await sendTransaction(code, args);
      setTxID(id);
      await waitForTransaction(id);
      setStatus("sealed");
      return id;
    } catch (err: unknown) {
      setStatus("error");
      // FCL throws plain objects (not Error instances) for on-chain reverts.
      // Extract errorMessage or message before wrapping.
      let message = "Unknown error";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null) {
        const e = err as Record<string, unknown>;
        message = String(e.errorMessage ?? e.message ?? JSON.stringify(err));
      } else {
        message = String(err);
      }
      console.error("[Transaction error]", message, err);
      const error = new Error(message);
      setError(error);
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxID(null);
    setError(null);
  }, []);

  return { execute, status, txID, error, reset };
}
