"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/borrow", label: "Borrow" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/collections", label: "Collections" },
] as const;

export function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isLoggedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-[60px] border-b border-[rgba(66,87,138,0.10)] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-content items-center justify-between px-6 lg:px-[72px]">
        {/* Logo — go to dashboard when logged in, landing page otherwise */}
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.png"
            alt="Moments Money"
            height={32}
            width={220}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                "text-sm font-medium transition-colors",
                pathname === href
                  ? "text-brand-orange"
                  : "text-brand-dark hover:text-brand-orange",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop wallet + mobile hamburger */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <WalletButton />
          </div>

          {/* Hamburger */}
          <button
            className="flex items-center justify-center rounded p-1.5 text-brand-dark transition-colors hover:bg-gray-100 md:hidden"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-[rgba(66,87,138,0.10)] bg-white px-6 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-3" aria-label="Mobile navigation">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={[
                  "rounded px-3 py-2 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-gray-100 text-brand-orange"
                    : "text-brand-dark hover:bg-gray-100 hover:text-brand-orange",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-4">
            <WalletButton />
          </div>
        </div>
      )}
    </header>
  );
}
