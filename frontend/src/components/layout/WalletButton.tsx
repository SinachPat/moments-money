"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { shortenAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { fcl } from "@/lib/fcl";

// Wallets to suppress from the picker — keyed by provider address or service uid.
// Blocto shut down their Flow wallet service in 2024.
// Addresses confirmed from live FCL Discovery API response (may differ from docs).
const EXCLUDED_WALLET_ADDRESSES = new Set([
  "0xf086a545ce3c552d", // Blocto — documented testnet/mainnet address
  "0x55ad22f01ef568a1", // Blocto — live API address (testnet)
]);
const EXCLUDED_WALLET_UIDS = new Set([
  "blocto#authn", // Blocto uid — stable across address changes
]);

interface WalletService {
  uid: string;
  endpoint: string;
  method: string;
  provider?: {
    name?: string;
    icon?: string;
    address?: string;
    color?: string;
    description?: string;
  };
}

// ─── Wallet Picker Modal ──────────────────────────────────────────────────────

function WalletPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (service: WalletService) => void;
}) {
  const [services, setServices] = useState<WalletService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const network = process.env.NEXT_PUBLIC_FLOW_NETWORK ?? "testnet";
    const endpoint = `https://fcl-discovery.onflow.org/api/${network}/authn`;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: ["authn"],
        fclVersion: "1.21.9",
        include: [],
        exclude: [],
        features: { suggested: [] },
        userAgent: navigator.userAgent,
        clientServices: [],
        supportedStrategies: [
          "HTTP/POST",
          "IFRAME/RPC",
          "POP/RPC",
          "TAB/RPC",
          "EXT/RPC",
          "WC/RPC",
        ],
        network,
        port: null,
      }),
    })
      .then((res) => res.json())
      .then((wallets: WalletService[]) => {
        const filtered = wallets.filter(
          (w) =>
            (!w.provider?.address ||
              !EXCLUDED_WALLET_ADDRESSES.has(w.provider.address)) &&
            !EXCLUDED_WALLET_UIDS.has(w.uid),
        );
        setServices(filtered);
      })
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect a Wallet">
      <div className="space-y-2 py-1 min-h-[160px]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
          </div>
        ) : services.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No wallets found. Make sure you have a Flow-compatible wallet
            installed.
          </p>
        ) : (
          services.map((service) => (
            <button
              key={service.uid}
              onClick={() => onSelect(service)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 text-left transition-all hover:border-brand-orange/30 hover:bg-orange-50"
            >
              {service.provider?.icon ? (
                <Image
                  src={service.provider.icon}
                  alt={service.provider.name ?? "Wallet"}
                  width={36}
                  height={36}
                  className="rounded-lg"
                  unoptimized
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-lg"
                  style={{
                    backgroundColor: service.provider?.color ?? "#e5e7eb",
                  }}
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-dark">
                  {service.provider?.name ?? "Unknown Wallet"}
                </p>
                {service.provider?.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {service.provider.description}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400">→</span>
            </button>
          ))
        )}

        <p className="pt-2 text-center text-xs text-gray-400">
          Don&apos;t have a wallet?{" "}
          <a
            href="https://wallet.flow.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-orange hover:underline"
          >
            Get Flow Wallet →
          </a>
        </p>
      </div>
    </Modal>
  );
}

// ─── Wallet Button ────────────────────────────────────────────────────────────

export function WalletButton() {
  const { isLoggedIn, isLoading, isDapper, address, logOut } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [showDapperModal, setShowDapperModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Tracks whether this specific button click initiated the login flow.
  // Prevents auto-redirecting users whose FCL session was restored on page load.
  const loginInitiated = useRef(false);

  useEffect(() => {
    if (loginInitiated.current && isLoggedIn && pathname === "/") {
      loginInitiated.current = false;
      router.push("/dashboard");
    }
  }, [isLoggedIn, pathname, router]);

  const handleWalletSelect = async (service: WalletService) => {
    loginInitiated.current = true;
    setShowPicker(false);
    // Point FCL at this wallet's authn endpoint and let FCL drive the full
    // auth protocol. Passing raw service objects from the HTTP discovery API
    // to fcl.authenticate() breaks EXT/RPC wallets — FCL's extension-matching
    // logic requires service objects that went through its internal pipeline.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fcl as any).config.put("discovery.wallet", service.endpoint);
    await fcl.authenticate();
  };

  if (isLoading) {
    return (
      <div className="h-10 w-32 animate-pulse rounded bg-gray-100" aria-hidden="true" />
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <Button variant="primary" size="md" onClick={() => setShowPicker(true)}>
          Connect Wallet
        </Button>

        <WalletPickerModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleWalletSelect}
        />
      </>
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
            Moments to Flow Wallet, Lilico, or NuFi.
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
