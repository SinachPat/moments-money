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
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxID(null);
    setError(null);
  }, []);

  return { execute, status, txID, error, reset };
}
