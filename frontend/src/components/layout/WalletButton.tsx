"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { shortenAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function WalletButton() {
  const { isLoggedIn, isLoading, isDapper, address, logIn, logOut } = useAuth();
  const [showDapperModal, setShowDapperModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Set to true only when the user actively clicks "Connect Wallet" this session.
  // Prevents redirecting users who already have a stored session.
  const loginInitiated = useRef(false);

  useEffect(() => {
    if (loginInitiated.current && isLoggedIn && pathname === "/") {
      loginInitiated.current = false;
      router.push("/dashboard");
    }
  }, [isLoggedIn, pathname, router]);

  const handleLogin = () => {
    loginInitiated.current = true;
    logIn();
  };

  if (isLoading) {
    return (
      <div className="h-10 w-32 animate-pulse rounded bg-gray-100" aria-hidden="true" />
    );
  }

  if (!isLoggedIn) {
    return (
      <Button variant="primary" size="md" onClick={handleLogin}>
        Connect Wallet
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {isDapper && (
          <button
            onClick={() => setShowDapperModal(true)}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
            title="Dapper Wallet — migration needed"
          >
            <span aria-hidden="true">⚠</span>
            <span className="hidden sm:inline">Dapper</span>
          </button>
        )}

        <button
          onClick={logOut}
          className="group flex items-center gap-2 rounded border border-[rgba(66,87,138,0.15)] bg-white px-3 py-2 text-sm font-medium text-brand-dark transition-all hover:border-status-critical hover:text-status-critical"
          title="Disconnect wallet"
        >
          <span className="h-2 w-2 rounded-full bg-status-success group-hover:bg-status-critical transition-colors" />
          <span>{address ? shortenAddress(address) : "Connected"}</span>
          <span className="hidden text-xs text-gray-500 group-hover:inline">
            Disconnect
          </span>
        </button>
      </div>

      <Modal
        isOpen={showDapperModal}
        onClose={() => setShowDapperModal(false)}
        title="Dapper Wallet — Migration Needed"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Moments Money requires direct collateral transfers, which Dapper
            Wallet doesn&apos;t support. To use the protocol, migrate your
            Moments to Flow Wallet or Blocto.
          </p>
          <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              Your NFTs are safe. Migration only moves them to a self-custody wallet.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="https://support.nbatopshot.com/hc/en-us/articles/how-to-migrate"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center rounded bg-brand-orange px-5 text-sm font-medium text-white transition-all duration-[250ms] hover:bg-brand-orange-hover hover:shadow-orange-glow"
            >
              Open Migration Guide →
            </a>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowDapperModal(false)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
