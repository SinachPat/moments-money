"use client";

import type { TxStatus } from "@/hooks/useTransaction";

interface TransactionStatusProps {
  status: TxStatus;
  txID: string | null;
  successMessage: string;
  errorMessage?: string;
}

const flowscanBase =
  process.env.NEXT_PUBLIC_FLOWSCAN_URL ?? "https://testnet.flowscan.org";

export function TransactionStatus({
  status,
  txID,
  successMessage,
  errorMessage,
}: TransactionStatusProps) {
  if (status === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-center gap-3 rounded-card px-5 py-4 text-sm font-medium",
        status === "pending" && "bg-gray-100 text-brand-dark",
        status === "sealed" && "bg-[#DCFCE7] text-[#16A34A]",
        status === "error" && "bg-[#FEE2E2] text-[#DC2626]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {status === "pending" && (
        <>
          <svg
            className="h-4 w-4 animate-spin shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Transaction pending…</span>
        </>
      )}

      {status === "sealed" && (
        <>
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
          <span className="flex-1">{successMessage}</span>
          {txID && (
            <a
              href={`${flowscanBase}/transaction/${txID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto underline underline-offset-2 hover:opacity-75"
            >
              View on Flowscan →
            </a>
          )}
        </>
      )}

      {status === "error" && (
        <>
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="flex-1">
            {errorMessage ?? "Transaction failed. Please try again."}
          </span>
        </>
      )}
    </div>
  );
}
