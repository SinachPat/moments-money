"use client";

import { useState } from "react";
import Link from "next/link";
import { useAllCollections } from "@/hooks/useCollection";
import { CollectionBadge } from "@/components/ui/CollectionBadge";
import { formatFlow } from "@/lib/utils";

// ─── FAQ accordion ────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "How is the floor price set?",
    a: "Floor prices are set by the Moments Money admin team based on real-time data from Flow NFT marketplaces. They are updated regularly to reflect current market conditions. Prices are always conservative — we use a trailing average, not the spot price, to protect borrowers from sudden drops.",
  },
  {
    q: "What happens if I don't repay?",
    a: "If your loan expires, you have a 24-hour grace period to repay. After that, your collateral can be forfeited by a keeper (any wallet that triggers the liquidation), who earns a small fee. Your outstanding loan balance is settled from the treasury, and your NFTs are transferred to the protocol.",
  },
  {
    q: "Can I use NFTs from multiple collections in one loan?",
    a: "Each loan is backed by items from a single collection. If you want to borrow against multiple collections, you can open separate loans for each. This keeps collateral valuations clean and predictable.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(66,87,138,0.15)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium text-brand-dark hover:text-brand-orange transition-colors"
        aria-expanded={open}
      >
        {q}
        <svg
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-gray-600">{a}</p>
      )}
    </div>
  );
}

// ─── Collections page ─────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const { collections, isLoading, error } = useAllCollections();

  // useAllCollections returns both active and inactive — split for display
  const active = collections.filter((c) => c.isActive);
  const inactive = collections.filter((c) => !c.isActive);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page header */}
      <div className="bg-white px-6 py-16 lg:px-[72px]">
        <div className="mx-auto max-w-content">
          <p className="mb-3 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
            Accepted collateral
          </p>
          <h1 className="mb-3 text-[clamp(30px,4vw,48px)] font-semibold tracking-h2 text-brand-dark">
            Supported Collections
          </h1>
          <p className="max-w-xl text-lg text-gray-600">
            Every collection below can be used as collateral to borrow FLOW.
          </p>
        </div>
      </div>

      <div className="px-6 py-12 lg:px-[72px]">
        <div className="mx-auto max-w-content space-y-12">

          {/* Active collections grid */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-card bg-white" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">
              Failed to load collections: {(error as Error).message}
            </p>
          ) : active.length === 0 ? (
            <p className="text-sm text-gray-500">
              No collections are currently active.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {active.map((c) => {
                const ltvPct = Math.round(parseFloat(c.ltvRatio) * 100);
                const maxBorrowPerNft = (
                  parseFloat(c.floorPrice) * parseFloat(c.ltvRatio)
                ).toFixed(2);
                const durationDays = Math.round(
                  parseFloat(c.maxLoanDuration) / 86400,
                );

                return (
                  <div
                    key={c.collectionIdentifier}
                    className="flex flex-col rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6 transition-all duration-[250ms] hover:shadow-card"
                  >
                    {/* Header */}
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold tracking-h3 text-brand-dark">
                        {c.displayName}
                      </h2>
                      <CollectionBadge
                        identifier={c.collectionIdentifier}
                        displayName={c.displayName}
                        tier={c.tier}
                      />
                    </div>

                    {/* Stats */}
                    <div className="mb-5 space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Floor price</span>
                        <span className="font-medium text-brand-dark">
                          {formatFlow(c.floorPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Borrow up to</span>
                        <span className="font-medium text-brand-dark">
                          {ltvPct}% of floor
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max loan duration</span>
                        <span className="font-medium text-brand-dark">
                          Up to {durationDays} days
                        </span>
                      </div>
                    </div>

                    {/* Example */}
                    <div className="mb-5 rounded border border-[rgba(66,87,138,0.12)] bg-gray-100 px-4 py-3 text-xs text-gray-600">
                      Deposit 1 item → borrow up to{" "}
                      <span className="font-semibold text-brand-dark">
                        {maxBorrowPerNft} FLOW
                      </span>
                    </div>

                    {/* Status */}
                    <div className="mb-5 flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                      Active
                    </div>

                    {/* CTA */}
                    <div className="mt-auto">
                      <Link
                        href={`/borrow?collection=${encodeURIComponent(c.collectionIdentifier)}`}
                        className="group inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:opacity-75 transition-opacity"
                      >
                        Borrow against {c.displayName}
                        <span className="transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inactive collections */}
          {inactive.length > 0 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-gray-500">
                Paused Collections
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactive.map((c) => (
                  <div
                    key={c.collectionIdentifier}
                    className="rounded-card border border-[rgba(66,87,138,0.10)] bg-white/60 p-6 opacity-60"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-gray-500">
                        {c.displayName}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                        Paused
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      This collection is temporarily unavailable as collateral.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          <div>
            <h2 className="mb-2 text-2xl font-semibold tracking-h3 text-brand-dark">
              Frequently asked questions
            </h2>
            <div className="mt-6 rounded-card border border-[rgba(66,87,138,0.15)] bg-white px-6">
              {FAQ_ITEMS.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
