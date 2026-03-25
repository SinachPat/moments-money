"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCollections, useMaxBorrowAmount } from "@/hooks/useCollection";
import { useNFTs } from "@/hooks/useNFTs";
import { useTransaction } from "@/hooks/useTransaction";
import { NFTCard } from "@/components/ui/NFTCard";
import { Button } from "@/components/ui/Button";
import { TransactionStatus } from "@/components/ui/TransactionStatus";
import { DapperWarningBanner } from "@/components/ui/DapperWarningBanner";
import { CollectionBadge } from "@/components/ui/CollectionBadge";
import {
  calculateInterest,
  calculateTotalRepayment,
  formatFlow,
} from "@/lib/utils";
import { getCollectionPaths } from "@/lib/collectionPaths";
import type { CollectionConfig } from "@/lib/types";

const contractAddress = process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "";

const DURATIONS = [
  { label: "7 days", seconds: 604800 },
  { label: "14 days", seconds: 1209600 },
  { label: "30 days", seconds: 2592000 },
] as const;

// ─── Create loan Cadence transaction ─────────────────────────────────────────

const CREATE_LOAN_TX = `
import MomentsMoney from 0xMomentsMoney
import "NonFungibleToken"
import "FungibleToken"

transaction(
    nftIDs: [UInt64],
    collectionIdentifier: String,
    collectionStoragePath: StoragePath,
    nftReceiverPublicPath: PublicPath,
    borrowAmount: UFix64,
    duration: UFix64,
    protocolAddress: Address
) {
    let nfts: @[{NonFungibleToken.NFT}]
    let flowReceiverCap: Capability<&{FungibleToken.Receiver}>
    let nftReturnReceiverCap: Capability<&{NonFungibleToken.Receiver}>
    let borrower: Address

    prepare(signer: auth(Storage) &Account) {
        let collection = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
            from: collectionStoragePath
        ) ?? panic("Could not borrow NFT collection from storage")

        self.nfts <- []
        for id in nftIDs {
            self.nfts.append(<- collection.withdraw(withdrawID: id))
        }

        self.flowReceiverCap = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        self.nftReturnReceiverCap = signer.capabilities.get<&{NonFungibleToken.Receiver}>(nftReceiverPublicPath)
        self.borrower = signer.address
    }

    pre {
        self.flowReceiverCap.check(): "No FLOW receiver capability — ensure flowTokenReceiver is published"
        self.nftReturnReceiverCap.check(): "No NFT receiver capability at the provided path"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        manager.createLoan(
            nfts: <- self.nfts,
            collectionIdentifier: collectionIdentifier,
            borrowAmount: borrowAmount,
            duration: duration,
            borrower: self.borrower,
            flowReceiverCap: self.flowReceiverCap,
            nftReturnReceiverCap: self.nftReturnReceiverCap
        )
    }
}`;

// ─── Claim test Moments Cadence transaction (testnet only) ───────────────────

const MOCK_MINTER_ADDRESS = "0x5f48399c13df4365";
const MOCK_MOMENT_IDENTIFIER = "A.5f48399c13df4365.MockMoment.NFT";

const CLAIM_TEST_MOMENTS_TX = `
import NonFungibleToken from 0x631e88ae7f1d7c20
import MockMoment       from 0x5f48399c13df4365

transaction {
    prepare(signer: auth(Storage, Capabilities) &Account) {

        // Set up collection if not already present
        if signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) == nil {
            signer.storage.save(
                <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>()),
                to: MockMoment.CollectionStoragePath
            )
            let cap = signer.capabilities.storage.issue<&MockMoment.Collection>(
                MockMoment.CollectionStoragePath
            )
            signer.capabilities.publish(cap, at: MockMoment.CollectionPublicPath)
        }

        // Borrow the public minter from the deployer account
        let minterCap = getAccount(0x5f48399c13df4365)
            .capabilities.get<&{MockMoment.MinterPublic}>(MockMoment.MinterPublicPath)
        if !minterCap.check() {
            panic("Could not borrow public Minter capability from deployer")
        }
        let minter = minterCap.borrow()!

        // Borrow the signer's collection and mint 5 NFTs into it
        let collection = signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) ?? panic("Collection not found")

        var i = 0
        while i < 5 {
            collection.deposit(token: <- minter.mintNFT())
            i = i + 1
        }
    }
}`;

// ─── FLOW/USD price hook ──────────────────────────────────────────────────────

function useFlowPrice() {
  const { data } = useQuery<number>({
    queryKey: ["flowPrice"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=flow&vs_currencies=usd",
      );
      const json = await res.json();
      return (json as { flow: { usd: number } }).flow.usd;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? 0;
}

// ─── Collection selector ──────────────────────────────────────────────────────

function CollectionSelector({
  collections,
  selected,
  onSelect,
}: {
  collections: CollectionConfig[];
  selected: CollectionConfig | null;
  onSelect: (c: CollectionConfig) => void;
}) {
  return (
    <div className="space-y-2">
      {collections.map((c) => (
        <button
          key={c.collectionIdentifier}
          onClick={() => onSelect(c)}
          className={[
            "flex w-full items-center justify-between rounded-card border px-5 py-4 text-left transition-all duration-[250ms]",
            selected?.collectionIdentifier === c.collectionIdentifier
              ? "border-brand-orange bg-white shadow-orange-glow"
              : "border-[rgba(66,87,138,0.15)] bg-white hover:border-[rgba(97,106,136,0.30)] hover:shadow-card",
          ].join(" ")}
        >
          <div>
            <p className="font-semibold text-brand-dark">{c.displayName}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Floor {formatFlow(c.floorPrice)} · Borrow up to{" "}
              {Math.round(parseFloat(c.ltvRatio) * 100)}%
            </p>
          </div>
          <CollectionBadge
            identifier={c.collectionIdentifier}
            displayName={c.displayName}
            tier={c.tier}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Borrow page (inner — must be inside Suspense for useSearchParams) ────────

function BorrowContent() {
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading: authLoading, isDapper, address } = useAuth();
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { execute, status: txStatus, txID, reset: resetTx } = useTransaction();
  const { execute: executeClaim, status: claimStatus, reset: resetClaim } = useTransaction();
  const flowPrice = useFlowPrice();

  const [selectedCollection, setSelectedCollection] =
    useState<CollectionConfig | null>(null);
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [borrowAmount, setBorrowAmount] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(1209600); // 14 days default

  // Pre-select collection from ?collection= query param
  useEffect(() => {
    const paramId = searchParams.get("collection");
    if (paramId && collections.length > 0) {
      const match = collections.find((c) => c.collectionIdentifier === paramId);
      if (match) setSelectedCollection(match);
    }
  }, [searchParams, collections]);

  // Reset NFT selection when collection changes
  useEffect(() => {
    setSelectedNFTs([]);
    setBorrowAmount(0);
  }, [selectedCollection?.collectionIdentifier]);

  const paths = selectedCollection
    ? getCollectionPaths(selectedCollection.collectionIdentifier)
    : null;

  const { nfts, isLoading: nftsLoading } = useNFTs(
    paths ? `/storage/${paths.storage}` : "",
    selectedCollection?.collectionIdentifier ?? "",
  );

  const { maxBorrow, isLoading: maxBorrowLoading } = useMaxBorrowAmount(
    selectedCollection?.collectionIdentifier ?? "",
    selectedNFTs.length,
  );

  const maxBorrowNum = parseFloat(maxBorrow);

  // Apply 50% default whenever NFT selection resets (sentinel < 0) or max resolves
  useEffect(() => {
    if (maxBorrowNum > 0 && borrowAmount < 0) {
      setBorrowAmount(Math.floor(maxBorrowNum * 0.5 * 100) / 100);
    }
  }, [maxBorrowNum, borrowAmount]);

  const toggleNFT = useCallback((id: string) => {
    setSelectedNFTs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // Use -1 as a sentinel so the 50% default effect fires even if the user
    // had manually typed 0 into the amount input (0 < 0 is false; -1 < 0 is true)
    setBorrowAmount(-1);
  }, []);

  const interest = selectedCollection
    ? calculateInterest(
        borrowAmount.toFixed(8),
        selectedCollection.interestRate,
        durationSeconds.toString(),
      )
    : "0";

  const totalRepayment = selectedCollection
    ? calculateTotalRepayment(
        borrowAmount.toFixed(8),
        selectedCollection.interestRate,
        durationSeconds.toString(),
      )
    : "0";

  const dueDate = new Date(Date.now() + durationSeconds * 1000).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

  const usdValue = (borrowAmount * flowPrice).toFixed(2);

  const canCreate =
    !isDapper &&
    selectedNFTs.length > 0 &&
    borrowAmount >= 1 &&
    borrowAmount <= maxBorrowNum &&
    txStatus !== "pending";

  async function handleCreateLoan() {
    if (!selectedCollection || !paths || !address) return;
    resetTx();

    await execute(CREATE_LOAN_TX, (arg, t) => [
      arg(selectedNFTs, t.Array(t.UInt64)),
      arg(selectedCollection.collectionIdentifier, t.String),
      arg({ domain: "storage", identifier: paths.storage }, t.Path),
      arg({ domain: "public", identifier: paths.public }, t.Path),
      arg(borrowAmount.toFixed(8), t.UFix64),
      arg(durationSeconds.toFixed(8), t.UFix64),
      arg(contractAddress, t.Address),
    ]);
  }

  const isMockMoment =
    selectedCollection?.collectionIdentifier === MOCK_MOMENT_IDENTIFIER;

  async function handleClaimTestMoments() {
    resetClaim();
    await executeClaim(CLAIM_TEST_MOMENTS_TX, () => []);
  }

  // Redirect if not connected (after auth resolves)
  if (!authLoading && !isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-brand-dark">
          Connect your wallet to borrow
        </p>
        <p className="text-sm text-gray-500">
          You need a Flow wallet to deposit collateral and receive FLOW.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-brand-orange hover:opacity-75"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  if (authLoading || collectionsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="px-6 py-10 lg:px-[72px]">
        <div className="mx-auto max-w-content">

          {/* Dapper warning */}
          {isDapper && (
            <div className="mb-6">
              <DapperWarningBanner />
            </div>
          )}

          <h1 className="mb-8 text-3xl font-semibold tracking-h3 text-brand-dark">
            Create a Loan
          </h1>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">

            {/* ── Left column ─────────────────────────────────────────── */}
            <div className="space-y-8">

              {/* Step 1: Collection */}
              <section className="rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6">
                <h2 className="mb-1 text-lg font-semibold text-brand-dark">
                  1. Choose a collection
                </h2>
                <p className="mb-5 text-sm text-gray-500">
                  Select the collection you want to borrow against.
                </p>
                {collections.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No collections are currently supported.
                  </p>
                ) : (
                  <CollectionSelector
                    collections={collections}
                    selected={selectedCollection}
                    onSelect={setSelectedCollection}
                  />
                )}
              </section>

              {/* Step 2: NFT grid */}
              {selectedCollection && (
                <section className="rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6">
                  <div className="mb-5 flex items-baseline justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-brand-dark">
                        2. Select your items
                      </h2>
                      <p className="mt-0.5 text-sm text-gray-500">
                        Choose which {selectedCollection.displayName} items to deposit.
                      </p>
                    </div>
                    {selectedNFTs.length > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-orange px-3 py-1 text-xs font-medium text-white">
                        {selectedNFTs.length} selected
                      </span>
                    )}
                  </div>

                  {nftsLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square animate-pulse rounded-card bg-gray-100"
                        />
                      ))}
                    </div>
                  ) : nfts.length === 0 ? (
                    <div className="rounded-card border border-dashed border-[rgba(66,87,138,0.20)] py-10 text-center">
                      <p className="text-sm font-medium text-gray-500">
                        You don&apos;t have any{" "}
                        {selectedCollection.displayName} items.
                      </p>
                      {isMockMoment ? (
                        <div className="mt-4 flex flex-col items-center gap-2">
                          <p className="text-xs text-gray-400">
                            This is a testnet collection — claim 5 free test NFTs to try the borrow flow.
                          </p>
                          <button
                            onClick={handleClaimTestMoments}
                            disabled={claimStatus === "pending"}
                            className="mt-1 rounded bg-brand-orange px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {claimStatus === "pending"
                              ? "Minting…"
                              : claimStatus === "sealed"
                              ? "✓ Claimed! Refresh to see your NFTs"
                              : "Claim 5 test NFTs →"}
                          </button>
                          {claimStatus === "error" && (
                            <button
                              onClick={resetClaim}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Transaction failed — tap to retry
                            </button>
                          )}
                        </div>
                      ) : (
                        <a
                          href={
                            selectedCollection.collectionIdentifier.includes("TopShot")
                              ? "https://nbatopshot.com/search?view=i"
                              : selectedCollection.collectionIdentifier.includes("AllDay")
                              ? "https://nflallday.com/marketplace/moments"
                              : selectedCollection.collectionIdentifier.includes("UFC")
                              ? "https://ufcstrike.com"
                              : "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-brand-orange hover:opacity-75"
                        >
                          Check out the marketplace →
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {nfts.map((nft) => (
                        <NFTCard
                          key={nft.id}
                          id={nft.id}
                          name={nft.name}
                          thumbnail={nft.thumbnail}
                          collectionName={selectedCollection.displayName}
                          isSelected={selectedNFTs.includes(nft.id)}
                          onToggle={() => toggleNFT(nft.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Step 3: Loan configuration */}
              {selectedNFTs.length > 0 && selectedCollection && (
                <section className="rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6">
                  <h2 className="mb-5 text-lg font-semibold text-brand-dark">
                    3. Configure your loan
                  </h2>

                  {/* Borrow amount */}
                  <div className="mb-6">
                    <div className="mb-2 flex items-baseline justify-between">
                      <label className="text-sm font-medium text-brand-dark">
                        Borrow amount
                      </label>
                      <span className="text-xs text-gray-500">
                        Max:{" "}
                        {maxBorrowLoading
                          ? "…"
                          : `${maxBorrowNum.toFixed(2)} FLOW`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={Math.max(maxBorrowNum, 1)}
                      step={0.01}
                      value={Math.max(0, borrowAmount)}
                      onChange={(e) => setBorrowAmount(parseFloat(e.target.value))}
                      disabled={maxBorrowLoading || maxBorrowNum === 0}
                      className="mb-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-orange"
                    />

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          max={maxBorrowNum}
                          step={0.01}
                          value={Math.max(0, borrowAmount)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v)) setBorrowAmount(Math.min(v, maxBorrowNum));
                          }}
                          className="h-11 w-full rounded border border-[rgba(66,87,138,0.15)] px-4 pr-16 text-sm font-medium text-brand-dark focus:border-brand-orange focus:outline-none"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                          FLOW
                        </span>
                      </div>
                      {flowPrice > 0 && (
                        <span className="text-sm text-gray-500">
                          ≈ ${usdValue} USD
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-brand-dark">
                      Loan duration
                    </label>
                    <div className="flex gap-2">
                      {DURATIONS.map(({ label, seconds }) => (
                        <button
                          key={seconds}
                          onClick={() => setDurationSeconds(seconds)}
                          className={[
                            "flex-1 rounded py-2.5 text-sm font-medium transition-all duration-[250ms]",
                            durationSeconds === seconds
                              ? "bg-brand-orange text-white shadow-orange-glow"
                              : "border border-[rgba(66,87,138,0.20)] bg-white text-brand-dark hover:border-[rgba(97,106,136,0.40)]",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ── Right column: Summary panel ──────────────────────────── */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-6">
                <h2 className="mb-5 text-lg font-semibold text-brand-dark">
                  Loan summary
                </h2>

                {selectedNFTs.length === 0 || !selectedCollection ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    Select a collection and items to see your loan summary.
                  </p>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Principal</span>
                      <span className="font-medium text-brand-dark">
                        {borrowAmount.toFixed(2)} FLOW
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Interest (
                        {Math.round(parseFloat(selectedCollection.interestRate) * 100)}
                        % APR)
                      </span>
                      <span className="font-medium text-brand-dark">
                        {parseFloat(interest).toFixed(4)} FLOW
                      </span>
                    </div>
                    <div className="my-2 border-t border-[rgba(66,87,138,0.10)]" />
                    <div className="flex justify-between">
                      <span className="font-medium text-brand-dark">
                        Total to repay
                      </span>
                      <span className="text-base font-semibold text-brand-dark">
                        {parseFloat(totalRepayment).toFixed(4)} FLOW
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Due date</span>
                      <span>{dueDate}</span>
                    </div>

                    <div className="mt-4 rounded border border-[rgba(66,87,138,0.12)] bg-gray-100 px-4 py-3 text-xs text-gray-500">
                      Your {selectedNFTs.length} item
                      {selectedNFTs.length !== 1 ? "s" : ""} will be held
                      securely until repaid.
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={!canCreate}
                    isLoading={txStatus === "pending"}
                    onClick={handleCreateLoan}
                  >
                    Create Loan
                  </Button>
                </div>

                {txStatus !== "idle" && (
                  <div className="mt-4">
                    <TransactionStatus
                      status={txStatus}
                      txID={txID}
                      successMessage="Loan created! Your FLOW is on the way."
                    />
                    {txStatus === "sealed" && (
                      <div className="mt-3 text-center">
                        <Link
                          href="/dashboard"
                          className="text-sm font-medium text-brand-orange hover:opacity-75"
                        >
                          View your loans →
                        </Link>
                      </div>
                    )}
                    {txStatus === "error" && (
                      <button
                        onClick={resetTx}
                        className="mt-2 w-full text-xs text-gray-500 hover:text-brand-dark"
                      >
                        Dismiss and retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export — Suspense required by Next.js 14 for useSearchParams ────────

export default function BorrowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
        </div>
      }
    >
      <BorrowContent />
    </Suspense>
  );
}
