// loan-expiry-monitor/src/index.ts
// Polls all active loans, sends expiry warnings (24h / 6h / 1h) via webhook,
// and liquidates loans that are past the 24-hour grace period.
// The keeper account earns 1 FLOW per liquidation.
//
// Environment variables:
//   FLOW_NETWORK                    — "testnet" | "mainnet"
//   MOMENTS_MONEY_CONTRACT_ADDRESS  — deployed contract address
//   KEEPER_PRIVATE_KEY              — hex-encoded ECDSA-P256 private key
//   KEEPER_ADDRESS                  — account that will receive keeper fees
//   POLL_INTERVAL_MS                — poll frequency (default: 5 minutes)
//   NOTIFICATION_WEBHOOK_URL        — optional POST target for expiry warnings

import * as fcl from "@onflow/fcl";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { ec as EC } from "elliptic";
import crypto from "crypto";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────

const FLOW_NETWORK = process.env.FLOW_NETWORK ?? "testnet";
const CONTRACT_ADDRESS = process.env.MOMENTS_MONEY_CONTRACT_ADDRESS ?? "";
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const KEEPER_ADDRESS = process.env.KEEPER_ADDRESS ?? "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 300_000);
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL;

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

// FCL deserializes Cadence values: UInt64 → string, UFix64 → string, Bool → boolean
interface LoanInfo {
  id: string;
  borrower: string;
  collectionIdentifier: string;
  nftIDs: string[];
  outstandingBalance: string;
  expiryTime: string; // unix timestamp as UFix64 string
  status: string;     // "Active" | "Repaid" | "Liquidated"
  isExpired: boolean;
  isInGracePeriod: boolean;
  isEligibleForLiquidation: boolean;
}

type WarningType = "24h" | "6h" | "1h" | "expired";

interface NotificationPayload {
  event: "loan_expiry_warning";
  warningType: WarningType;
  loanID: string;
  borrower: string;
  collectionName: string;
  nftCount: number;
  outstandingBalance: string;
  expiryTime: string;
  repayURL: string;
}

// ─── Cadence ─────────────────────────────────────────────────────────────────

// Iterates loan IDs 1..MomentsMoney.nextLoanID and returns all Active loans.
// MomentsMoney.nextLoanID is access(all), so scripts can read it directly.
const GET_ALL_ACTIVE_LOANS = `
import "MomentsMoney"

access(all) fun main(contractAddress: Address): [MomentsMoney.LoanInfo] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    var results: [MomentsMoney.LoanInfo] = []
    var id: UInt64 = 1

    while id < MomentsMoney.nextLoanID {
        if let info = manager.getLoanInfo(loanID: id) {
            if info.status == MomentsMoney.LoanStatus.Active {
                results.append(info)
            }
        }
        id = id + 1
    }

    return results
}`;

const LIQUIDATE_LOAN_TX = `
import "MomentsMoney"
import "FungibleToken"

transaction(loanID: UInt64, protocolAddress: Address) {
    let keeperFlowReceiverCap: Capability<&{FungibleToken.Receiver}>

    prepare(signer: auth(Storage) &Account) {
        self.keeperFlowReceiverCap = signer.capabilities.get<&{FungibleToken.Receiver}>(
            /public/flowTokenReceiver
        )
    }

    pre {
        self.keeperFlowReceiverCap.check(): "No FLOW receiver capability — keeper must have a flowTokenReceiver"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        let info = manager.getLoanInfo(loanID: loanID)
            ?? panic("Loan #".concat(loanID.toString()).concat(" does not exist"))

        if info.status != MomentsMoney.LoanStatus.Active {
            panic("Loan #".concat(loanID.toString()).concat(" is not active"))
        }

        if !info.isEligibleForLiquidation {
            panic("Loan #".concat(loanID.toString()).concat(" is not yet eligible for liquidation"))
        }

        manager.liquidateLoan(
            loanID: loanID,
            keeperFlowReceiverCap: self.keeperFlowReceiverCap
        )
    }
}`;

// ─── LoanMonitor ─────────────────────────────────────────────────────────────

class LoanMonitor {
  // In-memory dedup: loanID → set of warning types already sent this process run
  private readonly sentNotifications = new Map<string, Set<WarningType>>();
  // Avoid double-liquidation within the same process run
  private readonly liquidatedIDs = new Set<string>();

  // Returns loans that have crossed a new notification threshold.
  // Each threshold fires at most once per loan (per process run).
  private getLoansNeedingNotification(
    loans: LoanInfo[]
  ): Array<{ loan: LoanInfo; warningType: WarningType }> {
    const nowSeconds = Date.now() / 1000;
    const pending: Array<{ loan: LoanInfo; warningType: WarningType }> = [];

    for (const loan of loans) {
      const expiry = Number(loan.expiryTime);
      const secondsLeft = expiry - nowSeconds;
      const sent = this.sentNotifications.get(loan.id) ?? new Set<WarningType>();

      let threshold: WarningType | null = null;
      if (secondsLeft <= 0 && !sent.has("expired")) {
        threshold = "expired";
      } else if (secondsLeft <= 3_600 && secondsLeft > 0 && !sent.has("1h")) {
        threshold = "1h";
      } else if (secondsLeft <= 21_600 && secondsLeft > 3_600 && !sent.has("6h")) {
        threshold = "6h";
      } else if (secondsLeft <= 86_400 && secondsLeft > 21_600 && !sent.has("24h")) {
        threshold = "24h";
      }

      if (threshold) {
        sent.add(threshold);
        this.sentNotifications.set(loan.id, sent);
        pending.push({ loan, warningType: threshold });
      }
    }

    return pending;
  }

  private async sendNotification(
    loan: LoanInfo,
    warningType: WarningType
  ): Promise<void> {
    if (!NOTIFICATION_WEBHOOK_URL) return;

    const payload: NotificationPayload = {
      event: "loan_expiry_warning",
      warningType,
      loanID: loan.id,
      borrower: loan.borrower,
      collectionName: loan.collectionIdentifier,
      nftCount: loan.nftIDs.length,
      outstandingBalance: parseFloat(loan.outstandingBalance).toFixed(1),
      expiryTime: new Date(Number(loan.expiryTime) * 1000).toISOString(),
      repayURL: "https://momentsmoney.app/dashboard",
    };

    try {
      const response = await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
      log(`NOTIFY loan #${loan.id} — [${warningType}] warning sent`);
    } catch (err) {
      // Webhook failure must not block liquidations
      log(`ERROR  loan #${loan.id} — webhook failed: ${err}`);
    }
  }

  // Submit liquidation transaction and return the keeper fee (always 1 FLOW).
  private async liquidateLoan(loanID: string): Promise<number> {
    const authz = makeAuthz(KEEPER_ADDRESS, KEEPER_PRIVATE_KEY);
    const txID = await fcl.mutate({
      cadence: LIQUIDATE_LOAN_TX,
      args: (arg: any, t: any) => [
        arg(loanID, t.UInt64),
        arg(CONTRACT_ADDRESS, t.Address),
      ],
      proposer: authz,
      payer: authz,
      authorizations: [authz],
      limit: 9999,
    });
    await fcl.tx(txID).onceSealed();
    return 1.0; // KEEPER_FEE is a contract constant
  }

  private getEligibleLiquidations(loans: LoanInfo[]): LoanInfo[] {
    return loans.filter(
      (l) =>
        l.isEligibleForLiquidation && !this.liquidatedIDs.has(l.id)
    );
  }

  async runCycle(): Promise<void> {
    log("Starting loan monitor cycle");

    let loans: LoanInfo[];
    try {
      loans = (await fcl.query({
        cadence: GET_ALL_ACTIVE_LOANS,
        args: (arg: any, t: any) => [arg(CONTRACT_ADDRESS, t.Address)],
      })) as LoanInfo[];
      log(`Found ${loans.length} active loan(s)`);
    } catch (err) {
      log(`ERROR fetching active loans: ${err}`);
      return;
    }

    // Send expiry notifications (non-blocking — webhook failures are logged and skipped)
    const notifications = this.getLoansNeedingNotification(loans);
    for (const { loan, warningType } of notifications) {
      await this.sendNotification(loan, warningType);
    }

    // Liquidate eligible loans
    const eligible = this.getEligibleLiquidations(loans);
    if (eligible.length > 0) {
      log(`Found ${eligible.length} loan(s) eligible for liquidation`);
    }

    for (const loan of eligible) {
      try {
        log(
          `LIQUIDATE loan #${loan.id} — borrower ${loan.borrower}, ` +
            `debt ${parseFloat(loan.outstandingBalance).toFixed(2)} FLOW`
        );
        const keeperFee = await this.liquidateLoan(loan.id);
        this.liquidatedIDs.add(loan.id);
        log(`OK     loan #${loan.id} — earned ${keeperFee} FLOW keeper fee`);
      } catch (err) {
        // Expected: loan was repaid/liquidated between poll and tx submission
        log(`SKIP   loan #${loan.id} — already resolved or ineligible: ${err}`);
      }
    }

    log("Loan monitor cycle complete\n");
  }

  async start(): Promise<void> {
    await this.runCycle();
    setInterval(() => this.runCycle(), POLL_INTERVAL_MS);
    log(
      `Loan monitor running — polling every ${POLL_INTERVAL_MS / 1000 / 60} minutes`
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const monitor = new LoanMonitor();

// Export runCycle() for serverless / Vercel Cron invocation
export const run = (): Promise<void> => monitor.runCycle();

// Continuous mode when executed directly
monitor.start().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
