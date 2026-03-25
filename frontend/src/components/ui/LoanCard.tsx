"use client";

import type { LoanInfo } from "@/lib/types";
import { formatFlow, formatTimeRemaining } from "@/lib/utils";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { CollectionBadge } from "./CollectionBadge";

interface LoanCardProps {
  loan: LoanInfo;
  onRepayClick: () => void;
  /** Collection tier — passed by the caller from CollectionConfig.tier. Defaults to 1. */
  tier?: 1 | 2 | 3;
}

const urgencyTimeClass: Record<"safe" | "warning" | "critical", string> = {
  safe: "text-status-success",
  warning: "text-status-warning",
  critical: "text-status-critical",
};

export function LoanCard({ loan, onRepayClick, tier = 1 }: LoanCardProps) {
  const { text: timeText, urgency } = formatTimeRemaining(loan.expiryTime);

  // Derive a display status that includes grace period distinction
  const displayStatus =
    loan.status === "Active" && loan.isInGracePeriod
      ? ("Grace Period" as const)
      : (loan.status as "Active" | "Repaid" | "Liquidated");

  const isRepayable = loan.status === "Active";

  return (
    <div className="flex flex-col gap-4 rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6 transition-shadow duration-[250ms] hover:shadow-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-brand-dark">
            {loan.nftIDs.length} Item{loan.nftIDs.length !== 1 ? "s" : ""}
          </p>
          <CollectionBadge
            identifier={loan.collectionIdentifier}
            displayName={loan.collectionIdentifier.split(".").pop() ?? loan.collectionIdentifier}
            tier={tier}
          />
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {/* Amounts */}
      <div className="flex gap-6">
        <div>
          <p className="text-xs text-gray-500">Borrowed</p>
          <p className="text-sm font-medium text-brand-dark">
            {formatFlow(loan.principal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-base font-semibold tracking-heading text-brand-dark">
            {formatFlow(loan.outstandingBalance)}
          </p>
        </div>
      </div>

      {/* Time remaining */}
      {isRepayable && (
        <div className="flex items-center gap-1.5">
          <svg
            className={`h-3.5 w-3.5 shrink-0 ${urgencyTimeClass[urgency]}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
              clipRule="evenodd"
            />
          </svg>
          <span className={`text-xs font-medium ${urgencyTimeClass[urgency]}`}>
            {timeText} remaining
          </span>
        </div>
      )}

      {/* Repay button */}
      {isRepayable && (
        <Button variant="secondary" size="sm" onClick={onRepayClick} className="w-full">
          Repay
        </Button>
      )}
    </div>
  );
}
