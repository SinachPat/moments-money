"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";

const SESSION_KEY = "mm_beta_welcomed";

export function BetaWelcomeModal() {
  const { isLoggedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevLoggedIn = useRef(false);

  // Only render portal after hydration
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isLoggedIn && !prevLoggedIn.current) {
      // FCL restores existing sessions on page refresh via the same false→true
      // transition as a real login. sessionStorage survives refreshes but is
      // cleared when the tab closes or the user logs out — so this flag
      // distinguishes "session restored" from "just logged in".
      if (!sessionStorage.getItem(SESSION_KEY)) {
        setIsOpen(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    }
    if (!isLoggedIn && prevLoggedIn.current) {
      // User logged out — clear flag so next login shows the modal again
      sessionStorage.removeItem(SESSION_KEY);
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-modal-title"
    >
      {/* Backdrop — not clickable, must use CTA */}
      <div
        className="absolute inset-0 bg-brand-navy/80 backdrop-blur-sm"
        style={{ animation: "fadeIn 0.3s ease-out" }}
        aria-hidden="true"
      />

      {/* Radial orange glow behind panel */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,89,0,0.12) 0%, transparent 70%)",
          animation: "fadeIn 0.5s ease-out",
        }}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[20px] bg-brand-navy shadow-2xl outline-none"
        style={{
          border: "1px solid rgba(255,89,0,0.2)",
          animation: "fadeScaleIn 0.4s cubic-bezier(0.19,1,0.22,1)",
        }}
        tabIndex={-1}
      >
        {/* Top decorative bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #FF5900 30%, #FF6B18 70%, transparent)",
          }}
        />

        <div className="px-8 pb-8 pt-7">
          {/* Beta badge */}
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1"
            style={{
              background: "rgba(255,89,0,0.12)",
              border: "1px solid rgba(255,89,0,0.3)",
              animation: "fadeIn 0.5s ease-out 0.1s both",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-orange"
              style={{ animation: "pulse 2s infinite" }}
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Beta
            </span>
          </div>

          {/* Headline */}
          <div
            style={{ animation: "fadeSlideUp 0.5s cubic-bezier(0.19,1,0.22,1) 0.15s both" }}
          >
            <h2
              id="beta-modal-title"
              className="text-[32px] font-semibold leading-tight tracking-[-0.5px] text-white"
            >
              Welcome to{" "}
              <span className="text-brand-orange">Moments Money</span>
              &nbsp;✦
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-300">
              We&apos;re so glad you&apos;re here. This is a live beta — a real
              product, actively being built and tested with the community.
            </p>
          </div>

          {/* Info cards */}
          <div
            className="mt-6 space-y-3"
            style={{ animation: "fadeSlideUp 0.5s cubic-bezier(0.19,1,0.22,1) 0.25s both" }}
          >
            {/* Test tokens card */}
            <div
              className="flex gap-4 rounded-[12px] p-4"
              style={{ background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.2)" }}
            >
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(255,149,0,0.15)] text-base">
                🪙
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFB340]">
                  Use Flow Testnet tokens only
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
                  This runs on Flow Testnet — no real money required or
                  accepted. Grab free test FLOW from the Flow Faucet before
                  you borrow.
                </p>
              </div>
            </div>

            {/* Rough edges card */}
            <div
              className="flex gap-4 rounded-[12px] p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] text-base">
                🔧
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-200">
                  Rough edges ahead — and we&apos;re sorry in advance
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
                  You may run into bugs or unexpected behaviour. We genuinely
                  apologise for any friction. Every report helps us ship a
                  better product, faster.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div
            className="mt-7"
            style={{ animation: "fadeSlideUp 0.5s cubic-bezier(0.19,1,0.22,1) 0.35s both" }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="group flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-orange px-6 py-3 text-sm font-semibold text-white transition-all duration-[250ms] hover:bg-brand-orange-hover"
              style={{ boxShadow: "0 4px 20px rgba(255,89,0,0.35)" }}
            >
              I&apos;m ready — let&apos;s go
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              By continuing you acknowledge this is a beta product on Flow
              Testnet.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
