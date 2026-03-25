"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMyLoans } from "@/hooks/useLoan";
import { LoanCard } from "@/components/ui/LoanCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { RepayModal } from "@/components/ui/RepayModal";
import { formatFlow } from "@/lib/utils";
import type { LoanInfo } from "@/lib/types";

// ─── Portfolio summary bar ────────────────────────────────────────────────────

function SummaryStat({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-eyebrow text-gray-500">
        {label}
      </p>
      {isLoading ? (
        <div className="h-7 w-28 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="text-2xl font-semibold tracking-heading text-brand-dark">
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Loan history table ───────────────────────────────────────────────────────

function LoanHistoryRow({ loan }: { loan: LoanInfo }) {
  const collectionShort =
    loan.collectionIdentifier.split(".").pop() ?? loan.collectionIdentifier;
  const startDate = new Date(
    parseFloat(loan.startTime) * 1000,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const displayStatus =
    loan.status === "Active" && loan.isInGracePeriod
      ? ("Grace Period" as const)
      : (loan.status as "Active" | "Repaid" | "Liquidated");

  return (
    <tr className="border-t border-[rgba(66,87,138,0.08)] text-sm">
      <td className="py-3 pr-4 font-mono text-xs text-gray-500">
        #{loan.id}
      </td>
      <td className="py-3 pr-4 font-medium text-brand-dark">
        {collectionShort}
      </td>
      <td className="py-3 pr-4 text-brand-dark">
        {formatFlow(loan.principal)}
      </td>
      <td className="py-3 pr-4 text-brand-dark">
        {formatFlow(loan.repaidAmount)}
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={displayStatus} />
      </td>
      <td className="py-3 text-gray-500">{startDate}</td>
    </tr>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const {
    activeLoans,
    historicalLoans,
    isLoading: loansLoading,
    refetch,
  } = useMyLoans();

  const [repayLoanID, setRepayLoanID] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Not connected
  if (!authLoading && !isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-brand-dark">
          Connect your wallet to view your loans
        </p>
        <p className="text-sm text-gray-500">
          Your active and historical loans will appear here.
        </p>
        <Link href="/" className="text-sm font-medium text-brand-orange hover:opacity-75">
          ← Back to home
        </Link>
      </div>
    );
  }

  // Portfolio totals
  const totalBorrowed = activeLoans.reduce(
    (sum, l) => sum + parseFloat(l.principal),
    0,
  );
  const activeCount = activeLoans.length;
  const interestPaid = historicalLoans
    .filter((l) => l.status === "Repaid")
    .reduce(
      (sum, l) =>
        sum +
        Math.max(
          0,
          parseFloat(l.repaidAmount) - parseFloat(l.principal),
        ),
      0,
    );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="px-6 py-10 lg:px-[72px]">
        <div className="mx-auto max-w-content space-y-8">

          <h1 className="text-3xl font-semibold tracking-h3 text-brand-dark">
            My Dashboard
          </h1>

          {/* ── Portfolio summary ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryStat
              label="Total Borrowed"
              value={`${totalBorrowed.toFixed(2)} FLOW`}
              isLoading={loansLoading}
            />
            <SummaryStat
              label="Active Loans"
              value={activeCount.toString()}
              isLoading={loansLoading}
            />
            <SummaryStat
              label="Collateral Items"
              value={activeLoans
                .reduce((sum, l) => sum + l.nftIDs.length, 0)
                .toString()}
              isLoading={loansLoading}
            />
            <SummaryStat
              label="Interest Paid"
              value={`${interestPaid.toFixed(4)} FLOW`}
              isLoading={loansLoading}
            />
          </div>

          {/* ── Active loans ───────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-brand-dark">
                Active Loans
              </h2>
              {!loansLoading && activeCount > 0 && (
                <span className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-medium text-white">
                  {activeCount}
                </span>
              )}
            </div>

            {loansLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="h-52 animate-pulse rounded-card bg-white"
                  />
                ))}
              </div>
            ) : activeLoans.length === 0 ? (
              <div className="rounded-card border border-dashed border-[rgba(66,87,138,0.20)] bg-white py-14 text-center">
                <p className="mb-3 text-sm font-medium text-gray-500">
                  No active loans.
                </p>
                <Link
                  href="/borrow"
                  className="text-sm font-medium text-brand-orange hover:opacity-75"
                >
                  Ready to borrow? →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    onRepayClick={() => setRepayLoanID(loan.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Loan history ───────────────────────────────────────────── */}
          {historicalLoans.length > 0 && (
            <section>
              <button
                onClick={() => setHistoryExpanded((v) => !v)}
                className="flex w-full items-center justify-between rounded-card border border-[rgba(66,87,138,0.15)] bg-white px-6 py-4 text-left transition-colors hover:bg-gray-50"
                aria-expanded={historyExpanded}
              >
                <span className="font-semibold text-brand-dark">
                  Loan History ({historicalLoans.length})
                </span>
                <svg
                  className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${historyExpanded ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {historyExpanded && (
                <div className="overflow-x-auto rounded-b-card border border-t-0 border-[rgba(66,87,138,0.15)] bg-white px-6 pb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-eyebrow text-gray-500">
                        <th className="pb-3 pt-4 pr-4">Loan ID</th>
                        <th className="pb-3 pt-4 pr-4">Collection</th>
                        <th className="pb-3 pt-4 pr-4">Borrowed</th>
                        <th className="pb-3 pt-4 pr-4">Repaid</th>
                        <th className="pb-3 pt-4 pr-4">Status</th>
                        <th className="pb-3 pt-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalLoans.map((loan) => (
                        <LoanHistoryRow key={loan.id} loan={loan} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        </div>
      </div>

      {/* Repay modal */}
      {repayLoanID && (
        <RepayModal
          loanID={repayLoanID}
          isOpen={true}
          onClose={() => setRepayLoanID(null)}
          onSuccess={() => {
            refetch();
            setRepayLoanID(null);
          }}
        />
      )}
    </div>
  );
}
