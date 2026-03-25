"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useProtocolStats } from "@/hooks/useProtocolStats";
import { useCollections } from "@/hooks/useCollection";
import { CollectionBadge } from "@/components/ui/CollectionBadge";
import { formatFlow } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// ─── Count-up animation ──────────────────────────────────────────────────────

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const elRef = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (to === 0) return;
    const el = elRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || fired.current) return;
        fired.current = true;
        const t0 = performance.now();
        const duration = 1400;
        const tick = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(eased * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);

  return (
    <span ref={elRef}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

function StatSkeleton() {
  return <div className="h-9 w-24 animate-pulse rounded bg-white/20" />;
}

// ─── NBA Top Shot mock card ───────────────────────────────────────────────────

function PlayerSilhouette() {
  return (
    <svg
      viewBox="0 0 110 130"
      width="160"
      height="190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="58" cy="22" r="10" fill="white" fillOpacity="0.9" />
      {/* Torso */}
      <path d="M48 32 Q58 30 68 32 L65 74 L52 74 Z" fill="white" fillOpacity="0.85" />
      {/* Right arm raised holding ball */}
      <path
        d="M68 38 Q80 24 88 14"
        stroke="white" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round"
      />
      {/* Left arm extended for balance */}
      <path
        d="M48 40 Q34 50 26 58"
        stroke="white" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round"
      />
      {/* Basketball */}
      <circle cx="91" cy="11" r="10" fill="#FF5900" fillOpacity="0.95" />
      <line x1="81" y1="11" x2="101" y2="11" stroke="#FF3D00" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="91" y1="1" x2="91" y2="21" stroke="#FF3D00" strokeWidth="1.5" strokeOpacity="0.7" />
      <path d="M85 4 Q91 11 85 18" stroke="#FF3D00" strokeWidth="1" fill="none" strokeOpacity="0.7" />
      <path d="M97 4 Q91 11 97 18" stroke="#FF3D00" strokeWidth="1" fill="none" strokeOpacity="0.7" />
      {/* Right leg forward */}
      <path
        d="M61 74 Q67 96 70 116"
        stroke="white" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round"
      />
      <path
        d="M70 116 L84 113"
        stroke="white" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"
      />
      {/* Left leg back */}
      <path
        d="M53 74 Q42 96 36 114"
        stroke="white" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round"
      />
      <path
        d="M36 114 L22 118"
        stroke="white" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"
      />
    </svg>
  );
}

type Rarity = "LEGENDARY" | "RARE" | "COMMON";

const rarityStyles: Record<Rarity, { bg: string; text: string }> = {
  LEGENDARY: { bg: "rgba(234,179,8,0.25)", text: "#fde047" },
  RARE: { bg: "rgba(168,85,247,0.25)", text: "#d8b4fe" },
  COMMON: { bg: "rgba(59,130,246,0.2)", text: "#93c5fd" },
};

function TopShotCard({
  name,
  team,
  serial,
  rarity,
  floor,
  gradientFrom,
  gradientVia,
  number,
  style,
}: {
  name: string;
  team: string;
  serial: string;
  rarity: Rarity;
  floor: string;
  gradientFrom: string;
  gradientVia: string;
  number: string;
  style?: React.CSSProperties;
}) {
  const { bg: rarityBg, text: rarityText } = rarityStyles[rarity];

  return (
    <div
      className="relative w-[320px] overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(145deg, ${gradientFrom}, ${gradientVia}, #020617)`,
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 12px 32px rgba(0,0,0,0.5)",
        height: "460px",
        ...style,
      }}
    >
      {/* Holographic shimmer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 45%, rgba(255,255,255,0.04) 65%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Big jersey number watermark */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden select-none">
        <span
          className="font-black leading-none text-white"
          style={{ fontSize: "230px", opacity: 0.07 }}
          aria-hidden="true"
        >
          {number}
        </span>
      </div>

      <div className="relative flex h-full flex-col p-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span
            className="font-bold uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            NBA TOP SHOT
          </span>
          <span
            className="rounded-full px-2.5 py-1 font-bold"
            style={{ fontSize: "10px", background: rarityBg, color: rarityText }}
          >
            {rarity}
          </span>
        </div>

        {/* Player silhouette */}
        <div className="flex flex-1 items-center justify-center">
          <PlayerSilhouette />
        </div>

        {/* Player info */}
        <div>
          <p className="text-xl font-bold leading-tight text-white">{name}</p>
          <p className="mt-1" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            {team}
          </p>

          {/* Serial + floor */}
          <div
            className="mt-4 flex items-center justify-between pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div>
              <p
                className="font-medium uppercase"
                style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
              >
                Serial
              </p>
              <p className="text-sm font-bold text-white">{serial}</p>
            </div>
            <div className="text-right">
              <p
                className="font-medium uppercase"
                style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
              >
                Floor
              </p>
              <p className="text-sm font-bold" style={{ color: "#FF5900" }}>
                {floor}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardStack() {
  return (
    // On mobile: single centered card. On lg+: full 3-card fan stack.
    <div className="relative mx-auto w-[320px] lg:h-[540px] lg:w-[420px] lg:mx-0">
      {/* Back card — hidden on mobile */}
      <div
        className="hidden lg:block absolute bottom-0 left-0"
        style={{ transform: "rotate(-9deg) translate(-28px, 18px)", zIndex: 1 }}
      >
        <TopShotCard
          name="Ja Morant"
          team="Memphis Grizzlies"
          serial="#7,832"
          rarity="RARE"
          floor="89 FLOW"
          gradientFrom="#064e3b"
          gradientVia="#1a2744"
          number="12"
        />
      </div>

      {/* Middle card — hidden on mobile */}
      <div
        className="hidden lg:block absolute bottom-0 left-0"
        style={{ transform: "rotate(-3deg) translate(-10px, 8px)", zIndex: 2 }}
      >
        <TopShotCard
          name="Stephen Curry"
          team="Golden State Warriors"
          serial="#2,156"
          rarity="RARE"
          floor="178 FLOW"
          gradientFrom="#713f12"
          gradientVia="#1a2744"
          number="30"
        />
      </div>

      {/* Front card — always visible, only rotated on desktop */}
      <div
        className="lg:absolute lg:bottom-0 lg:left-0 lg:rotate-[3deg]"
        style={{ zIndex: 3 }}
      >
        <TopShotCard
          name="LeBron James"
          team="Los Angeles Lakers"
          serial="#4,721"
          rarity="LEGENDARY"
          floor="245 FLOW"
          gradientFrom="#4c1d95"
          gradientVia="#1e1b4b"
          number="23"
        />
      </div>
    </div>
  );
}

// ─── Preview collection cards (shown when no on-chain collections registered) ─

const PREVIEW_COLLECTIONS = [
  {
    collectionIdentifier: "preview-base-set",
    displayName: "NBA Top Shot — Base Set",
    tier: 1 as const,
    floorPrice: "45.00000000",
    ltvRatio: "0.50000000",
  },
  {
    collectionIdentifier: "preview-holo-mvcs",
    displayName: "NBA Top Shot — Holo MVCS",
    tier: 1 as const,
    floorPrice: "280.00000000",
    ltvRatio: "0.50000000",
  },
  {
    collectionIdentifier: "preview-series4-rare",
    displayName: "NBA Top Shot — Series 4 Rare",
    tier: 2 as const,
    floorPrice: "120.00000000",
    ltvRatio: "0.40000000",
  },
];

// ─── Landing page ────────────────────────────────────────────────────────────

export default function Home() {
  const { stats, isLoading: statsLoading } = useProtocolStats();
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { isLoggedIn, logIn } = useAuth();

  return (
    <>
      {/* Maintenance banner */}
      {stats?.isPaused && (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 bg-amber-100 px-6 py-3 text-sm font-medium text-amber-900"
        >
          <span>⚠</span>
          <span>
            Moments Money is temporarily paused for maintenance. Existing loans
            are unaffected.
          </span>
        </div>
      )}

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy px-6 py-20 lg:px-[72px] lg:py-28">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 30% 50%, #FF5900, transparent)",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-content items-center gap-16 lg:grid-cols-2">
          {/* Left: copy */}
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
              NFT-Backed Lending on Flow
            </p>
            <h1 className="mb-6 text-[clamp(36px,5.5vw,68px)] font-semibold leading-[1.05] tracking-hero text-white">
              Your collection.
              <br />
              Your liquidity.
              <br />
              Your terms.
            </h1>
            <p className="mb-10 max-w-[480px] text-lg leading-relaxed text-gray-300">
              Deposit your NBA Top Shot Moments as collateral and borrow FLOW
              instantly — no selling, no credit check, no middlemen.
            </p>
            <div className="flex flex-wrap gap-4">
              {isLoggedIn ? (
                <Link
                  href="/borrow"
                  className="inline-flex h-12 items-center rounded px-7 text-base font-medium text-white bg-brand-orange transition-all duration-[250ms] hover:bg-brand-orange-hover hover:shadow-orange-glow"
                >
                  Borrow Now
                </Link>
              ) : (
                <button
                  onClick={logIn}
                  className="inline-flex h-12 items-center rounded px-7 text-base font-medium text-white bg-brand-orange transition-all duration-[250ms] hover:bg-brand-orange-hover hover:shadow-orange-glow"
                >
                  Connect Wallet
                </button>
              )}
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center rounded border border-white/20 px-7 text-base font-medium text-white transition-all duration-[250ms] hover:border-white/40 hover:bg-white/5"
              >
                How It Works
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/30">Works with</span>
              {["Flow Wallet", "Lilico", "NuFi", "Ledger"].map((w) => (
                <span
                  key={w}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/50"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Right: card stack */}
          <div className="flex items-center justify-center">
            <CardStack />
          </div>
        </div>
      </section>

      {/* ── 2. Stats bar ────────────────────────────────────────────────── */}
      <section className="bg-brand-dark px-6 py-10 lg:px-[72px]">
        <div className="mx-auto grid max-w-content grid-cols-2 divide-x divide-white/10 md:grid-cols-4">
          {(
            [
              {
                label: "Total Loans",
                value: statsLoading ? null : parseInt(stats?.totalLoans ?? "0"),
                suffix: "",
              },
              {
                label: "FLOW Disbursed",
                value: statsLoading
                  ? null
                  : Math.round(parseFloat(stats?.totalFlowDisbursed ?? "0")),
                suffix: " FLOW",
              },
              {
                label: "Repayment Rate",
                value: statsLoading ? null : 85,
                suffix: "%",
              },
              {
                label: "Collections Supported",
                value: collectionsLoading ? null : collections.length,
                suffix: "",
              },
            ] as const
          ).map(({ label, value, suffix }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 px-8 py-4 text-center"
            >
              <div className="text-3xl font-semibold text-white">
                {value === null ? (
                  <StatSkeleton />
                ) : (
                  <CountUp to={value} suffix={suffix} />
                )}
              </div>
              <p className="text-xs font-medium uppercase tracking-eyebrow text-gray-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Features ─────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-20 lg:px-[72px] lg:py-28">
        <div className="mx-auto max-w-content">
          <p className="mb-3 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
            Why Moments Money
          </p>
          <h2 className="mb-14 max-w-xl text-[clamp(28px,3.5vw,42px)] font-semibold tracking-h2 text-brand-dark">
            Get liquidity without giving up your collection
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                ),
                title: "Borrow in minutes",
                desc: "Connect your wallet, select your Moments, and receive FLOW. The entire process takes under five minutes.",
              },
              {
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ),
                title: "No credit check",
                desc: "Your Top Shot collection is the collateral. No credit history, no identity verification, no bank account needed.",
              },
              {
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                ),
                title: "Keep your upside",
                desc: "You never sell. If your collection rises in value while your loan is active, that gain is entirely yours on repayment.",
              },
              {
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                ),
                title: "Predictable cost",
                desc: "Flat fee structure. No compound interest, no surprise charges. You know exactly what repayment costs before you borrow.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-7 transition-all duration-[250ms] hover:shadow-card"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-brand-dark transition-colors duration-[250ms] group-hover:bg-brand-orange group-hover:text-white">
                  {icon}
                </div>
                <h3 className="mb-2 text-[17px] font-semibold tracking-h3 text-brand-dark">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. How it works ─────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="bg-gray-100 px-6 py-20 lg:px-[72px] lg:py-28"
      >
        <div className="mx-auto max-w-content">
          <p className="mb-3 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
            Simple by design
          </p>
          <h2 className="mb-14 text-[clamp(28px,4vw,48px)] font-semibold tracking-h2 text-brand-dark">
            Three steps to liquidity
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  </svg>
                ),
                title: "Connect your wallet",
                desc: "Link your Flow Wallet, Blocto, or Lilico in one click. No sign-up, no email, no KYC.",
                detail: "Your wallet is your identity on Flow.",
              },
              {
                step: "02",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ),
                title: "Deposit as collateral",
                desc: "Choose which Moments to use. The protocol calculates your borrowing power based on verified floor prices.",
                detail: "More Moments = more FLOW available.",
              },
              {
                step: "03",
                icon: (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                ),
                title: "Receive FLOW, repay anytime",
                desc: "FLOW lands in your wallet immediately. Repay the principal plus fee before the due date to reclaim your Moments.",
                detail: "Early repayment is always free.",
              },
            ].map(({ step, icon, title, desc, detail }) => (
              <div
                key={step}
                className="group relative rounded-card border border-[rgba(66,87,138,0.15)] bg-white p-8 transition-all duration-[250ms] hover:shadow-card"
              >
                {/* Step number background */}
                <div
                  className="pointer-events-none absolute right-6 top-6 select-none font-black leading-none text-brand-dark"
                  style={{ fontSize: "72px", opacity: 0.04 }}
                  aria-hidden="true"
                >
                  {step}
                </div>

                <div className="relative">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-brand-dark transition-colors duration-[250ms] group-hover:bg-brand-orange group-hover:text-white">
                      {icon}
                    </div>
                    <span className="text-xs font-semibold text-gray-500">
                      Step {step}
                    </span>
                  </div>
                  <h3 className="mb-2 text-xl font-semibold tracking-h3 text-brand-dark">
                    {title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-600">{desc}</p>
                  <p className="text-xs font-medium text-brand-orange">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Supported collections ─────────────────────────────────────── */}
      <section className="bg-white px-6 py-20 lg:px-[72px] lg:py-28">
        <div className="mx-auto max-w-content">
          <div className="mb-12 flex items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
                Accepted collateral
              </p>
              <h2 className="text-[clamp(28px,4vw,48px)] font-semibold tracking-h2 text-brand-dark">
                Supported collections
              </h2>
            </div>
            <Link
              href="/collections"
              className="group hidden items-center gap-1 text-sm font-medium text-brand-orange md:flex"
            >
              View all
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          {collectionsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-card bg-gray-100" />
              ))}
            </div>
          ) : (
            <>
              {collections.length === 0 && (
                <p className="mb-5 text-sm text-gray-500">
                  No collections are live yet — below is a preview of what will be supported at launch.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(collections.length > 0 ? collections.slice(0, 3) : PREVIEW_COLLECTIONS).map((c) => {
                  const isPreview = collections.length === 0;
                  return (
                    <div
                      key={c.collectionIdentifier}
                      className={`relative rounded-card border bg-white p-6 transition-all duration-[250ms] hover:shadow-card ${
                        isPreview
                          ? "border-dashed border-[rgba(66,87,138,0.25)]"
                          : "border-[rgba(66,87,138,0.15)]"
                      }`}
                    >
                      {isPreview && (
                        <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          Preview
                        </span>
                      )}
                      <div className="mb-4 flex items-start justify-between gap-3 pr-16">
                        <h3 className="text-lg font-semibold text-brand-dark">
                          {c.displayName}
                        </h3>
                      </div>
                      <div className="mb-4">
                        <CollectionBadge
                          identifier={c.collectionIdentifier}
                          displayName={c.displayName}
                          tier={c.tier}
                        />
                      </div>
                      <div className="space-y-1.5 text-sm text-gray-600">
                        <p>
                          Floor:{" "}
                          <span className="font-medium text-brand-dark">
                            {formatFlow(c.floorPrice)}
                          </span>
                        </p>
                        <p>
                          Borrow up to:{" "}
                          <span className="font-medium text-brand-dark">
                            {Math.round(parseFloat(c.ltvRatio) * 100)}% of floor
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6 md:hidden">
            <Link
              href="/collections"
              className="group inline-flex items-center gap-1 text-sm font-medium text-brand-orange"
            >
              View all collections
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. CTA footer ────────────────────────────────────────────────── */}
      <section className="bg-brand-navy px-6 py-24 text-center lg:px-[72px]">
        <div className="mx-auto max-w-content">
          <p className="mb-3 text-xs font-medium uppercase tracking-eyebrow text-brand-orange">
            Get started today
          </p>
          <h2 className="mb-4 text-[clamp(28px,4vw,52px)] font-semibold tracking-h2 text-white">
            Ready to unlock your collection?
          </h2>
          <p className="mb-10 text-lg text-gray-300">
            Get FLOW in minutes. Repay on your schedule. Keep every Moment.
          </p>
          {isLoggedIn ? (
            <Link
              href="/borrow"
              className="inline-flex h-12 items-center rounded px-8 text-base font-medium text-white bg-brand-orange transition-all duration-[250ms] hover:bg-brand-orange-hover hover:shadow-orange-glow"
            >
              Start Borrowing →
            </Link>
          ) : (
            <button
              onClick={logIn}
              className="inline-flex h-12 items-center rounded px-8 text-base font-medium text-white bg-brand-orange transition-all duration-[250ms] hover:bg-brand-orange-hover hover:shadow-orange-glow"
            >
              Connect Wallet →
            </button>
          )}
        </div>
      </section>
    </>
  );
}
