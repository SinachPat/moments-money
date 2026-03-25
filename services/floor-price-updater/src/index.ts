// floor-price-updater/src/index.ts
// Fetches NFT floor prices from Flowverse and submits on-chain update_collection
// transactions when prices diverge by more than 5%.
//
// Environment variables:
//   FLOW_NETWORK                    — "testnet" | "mainnet"
//   MOMENTS_MONEY_CONTRACT_ADDRESS  — deployed contract address
//   ADMIN_PRIVATE_KEY               — hex-encoded ECDSA-P256 private key
//   ADMIN_ADDRESS                   — account that holds the Admin resource
//   UPDATE_INTERVAL_MS              — cycle frequency (default: 6 hours)
//   MAX_PRICE_CHANGE_PCT            — reject updates > this fraction (default: 0.20)
//   FLOWVERSE_API_BASE_URL          — Flowverse API root

import * as fcl from "@onflow/fcl";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { ec as EC } from "elliptic";
import crypto from "crypto";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────

const FLOW_NETWORK = process.env.FLOW_NETWORK ?? "testnet";
const CONTRACT_ADDRESS = process.env.MOMENTS_MONEY_CONTRACT_ADDRESS ?? "";
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY ?? "";
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS ?? "";
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS ?? 21_600_000);
const MAX_PRICE_CHANGE_PCT = Number(process.env.MAX_PRICE_CHANGE_PCT ?? 0.2);
const FLOWVERSE_API_BASE_URL =
  process.env.FLOWVERSE_API_BASE_URL ?? "https://api.flowverse.co";

// ─── FCL ─────────────────────────────────────────────────────────────────────

// Standard contract addresses per network
const FUNGIBLE_TOKEN_ADDRESS =
  FLOW_NETWORK === "mainnet" ? "0xf233dcee88fe0abe" : "0x9a0766d93b6608b7";
const NON_FUNGIBLE_TOKEN_ADDRESS =
  FLOW_NETWORK === "mainnet" ? "0x1d7e57aa55817448" : "0x631e88ae7f1d7c20";
const FLOW_TOKEN_ADDRESS =
  FLOW_NETWORK === "mainnet" ? "0x1654653399040a61" : "0x7e60df042a9c0868";
const METADATA_VIEWS_ADDRESS =
  FLOW_NETWORK === "mainnet" ? "0x1d7e57aa55817448" : "0x631e88ae7f1d7c20";

fcl.config({
  "flow.network": FLOW_NETWORK,
  "accessNode.api":
    FLOW_NETWORK === "mainnet"
      ? "https://rest-mainnet.onflow.org"
      : "https://rest-testnet.onflow.org",
  // Named import resolution: "import MomentsMoney" → CONTRACT_ADDRESS
  "0xMomentsMoney": CONTRACT_ADDRESS,
  "0xFungibleToken": FUNGIBLE_TOKEN_ADDRESS,
  "0xNonFungibleToken": NON_FUNGIBLE_TOKEN_ADDRESS,
  "0xFlowToken": FLOW_TOKEN_ADDRESS,
  "0xMetadataViews": METADATA_VIEWS_ADDRESS,
});

// ─── Signing ─────────────────────────────────────────────────────────────────

const ec = new EC("p256");

function sign(privateKeyHex: string, messageHex: string): string {
  const msgHash = crypto
    .createHash("sha3-256")
    .update(Buffer.from(messageHex, "hex"))
    .digest();
  const key = ec.keyFromPrivate(Buffer.from(privateKeyHex, "hex"));
  const sig = key.sign(msgHash);
  const r = sig.r.toString("hex").padStart(64, "0");
  const s = sig.s.toString("hex").padStart(64, "0");
  return r + s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAuthz(address: string, privateKeyHex: string, keyIndex = 0): any {
  return async (account: any) => ({
    ...account,
    addr: address,
    keyId: keyIndex,
    signingFunction: async (signable: any) => ({
      addr: address,
      keyId: keyIndex,
      signature: sign(privateKeyHex, signable.message),
    }),
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CollectionConfig {
  collectionIdentifier: string;
  displayName: string;
  floorPrice: string; // UFix64 returned as string by FCL
  isActive: boolean;
}

// ─── Cadence ─────────────────────────────────────────────────────────────────

const GET_ALL_COLLECTIONS = `
import "MomentsMoney"

access(all) fun main(contractAddress: Address): [MomentsMoney.CollectionConfig] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getAllCollections()
}`;

const UPDATE_COLLECTION_TX = `
import "MomentsMoney"

transaction(
    collectionIdentifier: String,
    floorPrice: UFix64?,
    ltvRatio: UFix64?,
    interestRate: UFix64?,
    maxLoanDuration: UFix64?,
    isActive: Bool?
) {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — signer must be the protocol deployer")
    }

    execute {
        self.adminRef.updateCollection(
            collectionIdentifier: collectionIdentifier,
            floorPrice: floorPrice,
            ltvRatio: ltvRatio,
            interestRate: interestRate,
            maxLoanDuration: maxLoanDuration,
            isActive: isActive
        )
    }
}`;

// ─── FlowverseClient ─────────────────────────────────────────────────────────

// Expected response shape from Flowverse's collections endpoint.
// Actual field names depend on Flowverse's API version — adjust here if needed.
interface FlowverseCollection {
  identifier: string;
  floorPrice: number | null;
}

interface FlowverseCollectionsResponse {
  data: FlowverseCollection[];
}

class FlowverseClient {
  constructor(private readonly baseUrl: string) {}

  async getFloorPrices(): Promise<Map<string, number>> {
    const url = `${this.baseUrl}/v2/collections?page=1&pageSize=100`;
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Flowverse API error ${response.status}: ${response.statusText}`
      );
    }

    const json = (await response.json()) as FlowverseCollectionsResponse;
    const result = new Map<string, number>();

    for (const item of json.data) {
      if (item.identifier && item.floorPrice != null && item.floorPrice > 0) {
        result.set(item.identifier, item.floorPrice);
      }
    }

    return result;
  }
}

// ─── OnChainClient ───────────────────────────────────────────────────────────

class OnChainClient {
  async getActiveCollections(): Promise<CollectionConfig[]> {
    const all = (await fcl.query({
      cadence: GET_ALL_COLLECTIONS,
      args: (arg: any, t: any) => [arg(CONTRACT_ADDRESS, t.Address)],
    })) as CollectionConfig[];
    return all.filter((c) => c.isActive);
  }

  async updateFloorPrice(
    identifier: string,
    newPrice: number
  ): Promise<string> {
    const authz = makeAuthz(ADMIN_ADDRESS, ADMIN_PRIVATE_KEY);
    const txID = await fcl.mutate({
      cadence: UPDATE_COLLECTION_TX,
      args: (arg: any, t: any) => [
        arg(identifier, t.String),
        arg(newPrice.toFixed(8), t.Optional(t.UFix64)),
        arg(null, t.Optional(t.UFix64)),
        arg(null, t.Optional(t.UFix64)),
        arg(null, t.Optional(t.UFix64)),
        arg(null, t.Optional(t.Bool)),
      ],
      proposer: authz,
      payer: authz,
      authorizations: [authz],
      limit: 9999,
    });
    await fcl.tx(txID).onceSealed();
    return txID as string;
  }
}

// ─── FloorPriceUpdater ───────────────────────────────────────────────────────

class FloorPriceUpdater {
  private readonly flowverse = new FlowverseClient(FLOWVERSE_API_BASE_URL);
  private readonly onChain = new OnChainClient();

  // Returns true if the price should be submitted on-chain:
  // change > 5% (meaningful drift) AND < MAX_PRICE_CHANGE_PCT (not a runaway spike)
  private shouldUpdate(current: number, proposed: number): boolean {
    if (current === 0) return proposed > 0;
    const changePct = Math.abs(proposed - current) / current;
    return changePct > 0.05 && changePct < MAX_PRICE_CHANGE_PCT;
  }

  async run(): Promise<void> {
    log("Starting floor price update cycle");

    let marketPrices: Map<string, number>;
    try {
      marketPrices = await this.flowverse.getFloorPrices();
      log(`Fetched ${marketPrices.size} floor prices from Flowverse`);
    } catch (err) {
      log(`ERROR fetching from Flowverse: ${err}`);
      return;
    }

    let collections: CollectionConfig[];
    try {
      collections = await this.onChain.getActiveCollections();
      log(`Found ${collections.length} active on-chain collections`);
    } catch (err) {
      log(`ERROR fetching on-chain collections: ${err}`);
      return;
    }

    for (const col of collections) {
      const id = col.collectionIdentifier;
      const marketPrice = marketPrices.get(id);

      if (marketPrice == null) {
        log(`SKIP  ${id} — no Flowverse price available`);
        continue;
      }

      const currentPrice = parseFloat(col.floorPrice);
      const changePct =
        currentPrice > 0
          ? Math.abs(marketPrice - currentPrice) / currentPrice
          : 1;

      if (changePct >= MAX_PRICE_CHANGE_PCT) {
        log(
          `WARN  ${id} — ${(changePct * 100).toFixed(1)}% change exceeds ` +
            `MAX_PRICE_CHANGE_PCT (${(MAX_PRICE_CHANGE_PCT * 100).toFixed(0)}%) — skipping`
        );
        continue;
      }

      if (!this.shouldUpdate(currentPrice, marketPrice)) {
        log(
          `SKIP  ${id} — ${(changePct * 100).toFixed(1)}% change below 5% threshold ` +
            `(${currentPrice} → ${marketPrice} FLOW)`
        );
        continue;
      }

      try {
        log(
          `UPDATE ${id}: ${currentPrice} → ${marketPrice} FLOW ` +
            `(${changePct >= 0 ? "+" : ""}${(changePct * 100).toFixed(1)}%)`
        );
        const txID = await this.onChain.updateFloorPrice(id, marketPrice);
        log(`OK    ${id} — sealed in tx ${txID}`);
      } catch (err) {
        log(`ERROR ${id} — on-chain update failed: ${err}`);
      }
    }

    log("Floor price update cycle complete\n");
  }

  async start(): Promise<void> {
    await this.run();
    setInterval(() => this.run(), UPDATE_INTERVAL_MS);
    log(
      `Scheduler active — next cycle in ${UPDATE_INTERVAL_MS / 1000 / 60} minutes`
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const updater = new FloorPriceUpdater();

// Export run() for serverless / Vercel Cron invocation
export const run = (): Promise<void> => updater.run();

// Continuous mode when executed directly
updater.start().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
