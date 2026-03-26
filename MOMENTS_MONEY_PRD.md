# Moments Money — MVP Product Requirements Document

**Version**: 1.0
**Date**: March 24, 2026
**Author**: Patrick (Product)
**Status**: Draft

---

## 1. Problem Statement

Flow blockchain has 40+ million user accounts holding digital collectibles — NBA Top Shot moments, NFL ALL DAY highlights, Disney Pinnacle pins, and hundreds of other NFT collections. These assets have real market value, but that value is **locked**. If a user needs liquidity, their only option is to sell the collectible outright, permanently losing an asset they may have emotional or speculative attachment to.

There is no way to borrow against these assets on Flow today. Ethereum has NFTfi, Arcade, and BendDAO. Solana has Sharky. Flow has nothing.

Moments Money solves this by letting Flow NFT holders collateralize their collectibles to borrow FLOW — without selling.

---

## 2. Target User

**Primary persona: The Reluctant Seller**

A Flow user who holds NFT collectibles they value (emotionally or speculatively) but needs short-term liquidity. They would rather borrow against their assets than sell them. They may be crypto-familiar but not DeFi-native — they got into Flow through NBA Top Shot or a similar consumer product, not through yield farming.

Key characteristics:
- Holds NFTs on Flow worth $50–$5,000+
- Has used a Flow wallet (Blocto, Flow Wallet, Lilico, Dapper Wallet)
- Understands "collateral" conceptually (like a pawn shop) but has never used a DeFi lending protocol
- Needs $20–$2,000 in short-term liquidity (days to weeks)

**Secondary persona: The NFT Speculator**

A more sophisticated user who wants to leverage their NFT portfolio — borrow against holdings to buy more NFTs or participate in other opportunities without reducing their position. Comfortable with DeFi concepts.

---

## 3. MVP Scope

### What's IN (V1)

| Feature | Description |
|---------|-------------|
| **NFT Collateral Deposits** | Users deposit Flow NFTs from whitelisted collections into a protocol-managed collateral vault |
| **Borrowing** | Users borrow FLOW tokens against deposited collateral at a fixed interest rate |
| **Repayment** | Users repay the loan (principal + interest) to reclaim their collateral |
| **Collateral Reclaim** | On full repayment, NFTs are returned to the borrower's account |
| **Liquidation (simple)** | If a loan passes its expiry date without repayment, collateral is forfeited to the protocol treasury |
| **Collection Whitelist** | Admin-managed list of NFT collections eligible as collateral, each with a floor price and LTV ratio |
| **Partial Repayment** | Users can make partial repayments to reduce outstanding balance. Collateral is only released on full repayment. |
| **Loan Dashboard** | Web UI showing active loans, collateral status, time remaining, and repayment amounts |
| **Wallet Connection** | Flow Wallet, Blocto, and Lilico support via FCL |

### What's OUT (V2+)

| Feature | Reason for deferral |
|---------|-------------------|
| Two-sided lending (external lenders) | Adds massive complexity — prove borrower demand first |
| Variable interest rates | Requires rate curves and utilization tracking — fixed rate is simpler |
| Partial liquidation / auctions | Complex mechanism design — simple forfeiture for MVP |
| On-chain price oracles | No reliable NFT floor price oracle exists on Flow — use admin-set prices for MVP |
| Stablecoin borrowing (PYUSD, KUSD) | Adds token integration complexity — FLOW-only borrowing first |
| Multi-asset loans (bundle NFTs from different collections) | Valuation complexity — single-collection loans first |
| Mobile native app | Web-first, responsive design covers mobile |
| Governance / protocol token | Premature for MVP |
| Flash loans | Different product category |

---

## 4. Core Mechanics

### 4.1 Collection Whitelist

The protocol maintains an admin-managed whitelist of NFT collections eligible for collateral. Each whitelisted collection has:

| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionIdentifier` | String | The NFT contract identifier (e.g., `A.0b2a3299cc857e29.TopShot.NFT`) |
| `floorPrice` | UFix64 | Admin-set floor price in FLOW tokens |
| `ltvRatio` | UFix64 | Loan-to-value ratio (e.g., 0.40 = borrow up to 40% of floor price) |
| `maxLoanDuration` | UFix64 | Maximum loan duration in seconds |
| `isActive` | Bool | Whether the collection is currently accepting new loans |

**Why admin-set prices instead of oracles**: No reliable on-chain NFT floor price oracle exists on Flow today. Building or integrating one is a V2 concern. For MVP, the protocol admin updates floor prices periodically (daily or on significant market moves) based on off-chain marketplace data. This is an acknowledged centralization tradeoff — acceptable for MVP, must be decentralized in V2.

**Opening strategy**: Launch with 3–5 of the most liquid collections (NBA Top Shot, NFL ALL DAY, Disney Pinnacle) to prove the model. The whitelist architecture supports adding any Flow NFT collection over time.

### 4.2 Loan Lifecycle

```
[User deposits NFT] → [Loan created] → [FLOW disbursed to user]
         ↓
    [Loan active — interest accruing]
         ↓
   ┌─────┴─────┐
   ↓            ↓
[User repays]  [Loan expires]
   ↓            ↓
[NFT returned] [NFT forfeited to protocol]
```

**Step-by-step:**

1. **Deposit & Borrow**: User selects NFTs from their wallet, deposits them into the protocol's collateral vault. The protocol calculates the maximum borrowable amount based on `floorPrice × ltvRatio × numberOfNFTs`. User chooses how much to borrow (up to the max). FLOW tokens are transferred from the protocol treasury to the user's wallet. A Loan record is created on-chain.

2. **Active Loan**: Interest accrues at a fixed rate from the moment of borrowing. The user can check their outstanding balance (principal + accrued interest) at any time via the dashboard or an on-chain script.

3. **Repayment**: The user sends FLOW tokens back to the protocol covering principal + accrued interest. Partial repayments are accepted (they reduce outstanding balance but don't release collateral until fully repaid). On full repayment, all collateral NFTs are returned to the borrower's wallet in a single transaction.

4. **Collateral Return Safety**: On full repayment, the protocol returns NFTs to the borrower's address. The `create_loan` transaction verifies that the borrower has a valid `NonFungibleToken.Receiver` capability for the collateral collection type before accepting the loan. This ensures NFTs can always be returned.

5. **Expiry / Forfeiture**: If the loan reaches its expiry date without full repayment, the collateral is forfeited. The protocol retains the NFTs in its treasury. The borrower keeps whatever FLOW they borrowed. No partial recovery — the entire collateral bundle is forfeited. An event is emitted for off-chain tracking.

### 4.3 Interest Rate Model

**MVP: Fixed rate, admin-set per collection.**

| Parameter | Value (suggested starting point) |
|-----------|----------------------------------|
| Base interest rate | 15% APR |
| Loan duration | 7, 14, or 30 days (user selects) |
| Interest calculation | Simple interest: `principal × rate × (duration / 365)` |

Interest is calculated at repayment time, not compounded. This keeps the math simple for users and the smart contracts.

**Example**: User borrows 100 FLOW for 14 days at 15% APR.
- Interest = 100 × 0.15 × (14/365) = 0.575 FLOW
- Total repayment = 100.575 FLOW

### 4.4 Loan-to-Value (LTV) Ratios

Conservative LTV ratios for MVP to minimize protocol risk:

| Collection Tier | LTV Ratio | Rationale |
|----------------|-----------|-----------|
| Tier 1 (NBA Top Shot, NFL ALL DAY) | 40% | High liquidity, established market |
| Tier 2 (Disney Pinnacle, other major collections) | 30% | Moderate liquidity |
| Tier 3 (newer/smaller collections) | 20% | Low liquidity, higher risk |

**Example**: User deposits an NBA Top Shot moment with floor price of 500 FLOW. Max borrow = 500 × 0.40 = 200 FLOW.

### 4.5 Liquidation (Forfeiture Model)

MVP uses **time-based forfeiture** — the simplest possible liquidation mechanism:

- If `currentTime > loan.startTime + loan.duration` AND `loan.outstandingBalance > 0`, the loan is eligible for forfeiture
- Anyone can call a public `liquidate(loanID)` transaction to trigger forfeiture (incentivized by a fixed keeper fee of 1 FLOW paid from the protocol treasury)
- On forfeiture: all collateral NFTs are transferred to the protocol's treasury address
- The borrower's debt is written off — they keep the borrowed FLOW
- A `LoanLiquidated` event is emitted

**Why no price-based liquidation for MVP**: Price-based liquidation (trigger when collateral value drops below a threshold) requires reliable real-time oracles. Since MVP uses admin-set prices updated periodically, there's too much latency for safe price-based liquidation. Time-based forfeiture is deterministic and doesn't depend on price feeds.

---

## 5. Smart Contract Architecture

### 5.1 Contract Overview

```
MomentsMoney (main contract)
├── CollateralVault (resource)      — Holds deposited NFTs per loan
├── Loan (resource)                 — Tracks loan state and terms
├── LoanManager (resource)          — Creates/manages loans, holds treasury
├── CollectionConfig (struct)       — Whitelist entry for an NFT collection
├── LoanInfo (struct)               — Read-only loan data for scripts
└── Admin (resource)                — Update whitelist, set rates, manage treasury
```

### 5.2 Key Resources

**CollateralVault**
- Stores NFTs for a single loan
- Supports any NFT type implementing `NonFungibleToken.NFT`
- Tracks deposited NFT IDs and their collection type
- Only the LoanManager can deposit/withdraw (access(contract))

**Loan**
- Immutable fields: id, borrower address, principal, interest rate, start time, duration, collateral NFT IDs, collection identifier
- Mutable fields: repaid amount, status (Active/Repaid/Liquidated)
- View functions for outstanding balance calculation
- Cannot be transferred — lives in the protocol's storage

**LoanManager**
- Singleton resource created at contract init
- Holds the FLOW treasury vault for disbursing loans
- Maintains a mapping of loan IDs to Loan resources
- Maintains a mapping of loan IDs to CollateralVault resources
- Exposes public capability for read-only loan queries
- Contract-access functions for creating loans, processing repayments, and executing liquidations

**Admin**
- Singleton resource for protocol governance
- Can add/remove/update whitelisted collections
- Can update interest rates
- Can deposit FLOW into the treasury
- Can withdraw protocol-earned interest and forfeited NFTs

### 5.3 Storage Architecture

```
Protocol Account Storage:
  /storage/momentsMoneyLoanManager    → @LoanManager (singleton)
  /storage/momentsMoneyAdmin          → @Admin (singleton)

Public Capabilities:
  /public/momentsMoneyLoanInfo        → &LoanManager (read-only: getLoanInfo, getCollectionConfig, etc.)

User Account Storage:
  (no protocol-specific storage required on user accounts)
```

### 5.4 Transaction List

| Transaction | Signer | Description |
|-------------|--------|-------------|
| `create_loan` | Borrower | Deposit NFTs, specify borrow amount and duration. Receives FLOW. |
| `repay_loan` | Borrower | Send FLOW to cover partial or full repayment. On full repayment, NFTs returned. |
| `liquidate_loan` | Anyone | Trigger forfeiture on expired loans. Caller receives fixed 1 FLOW keeper fee from treasury. |
| `add_collection` | Admin | Add a new NFT collection to the whitelist. |
| `update_collection` | Admin | Update floor price, LTV, or active status for a collection. |
| `remove_collection` | Admin | Remove a collection from the whitelist (existing loans unaffected). |
| `deposit_treasury` | Admin | Add FLOW to the lending treasury. |
| `withdraw_treasury` | Admin | Withdraw FLOW from the treasury (protocol earnings). |
| `withdraw_forfeited_nfts` | Admin | Claim forfeited NFTs from liquidated loans. |
| `pause_protocol` | Admin | Pause all new loan creation (existing loans unaffected). |
| `unpause_protocol` | Admin | Resume new loan creation. |

### 5.5 Script List (Read-Only Queries)

| Script | Description |
|--------|-------------|
| `get_loan_info` | Returns loan details by ID (borrower, principal, interest, collateral, status, time remaining) |
| `get_active_loans_by_address` | Returns all active loan IDs for a given borrower address |
| `get_collection_config` | Returns whitelist config for a specific NFT collection |
| `get_all_collections` | Returns all whitelisted collections and their parameters |
| `get_max_borrow_amount` | Given a collection and number of NFTs, returns max borrowable FLOW |
| `get_outstanding_balance` | Returns current amount owed on a specific loan |
| `get_treasury_balance` | Returns available FLOW in the lending treasury |
| `get_protocol_stats` | Returns aggregate stats (total loans, TVL, total interest earned) |

### 5.6 Events

```cadence
// Loan lifecycle
access(all) event LoanCreated(loanID: UInt64, borrower: Address, principal: UFix64, interestRate: UFix64, duration: UFix64, collectionIdentifier: String, nftIDs: [UInt64])
access(all) event LoanRepayment(loanID: UInt64, borrower: Address, amount: UFix64, remainingBalance: UFix64)
access(all) event LoanFullyRepaid(loanID: UInt64, borrower: Address, totalInterestPaid: UFix64)
access(all) event LoanLiquidated(loanID: UInt64, borrower: Address, outstandingDebt: UFix64, collateralNFTIDs: [UInt64])

// Collateral
access(all) event CollateralDeposited(loanID: UInt64, collectionIdentifier: String, nftIDs: [UInt64])
access(all) event CollateralReturned(loanID: UInt64, borrower: Address, nftIDs: [UInt64])

// Admin
access(all) event CollectionAdded(identifier: String, floorPrice: UFix64, ltvRatio: UFix64)
access(all) event CollectionUpdated(identifier: String, floorPrice: UFix64, ltvRatio: UFix64)
access(all) event CollectionRemoved(identifier: String)
access(all) event TreasuryDeposit(amount: UFix64)
access(all) event TreasuryWithdrawal(amount: UFix64)
```

---

## 6. Frontend Requirements

### 6.1 Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14+ (App Router) | React ecosystem, SSR for SEO, API routes for off-chain services |
| Styling | Tailwind CSS | Rapid iteration, responsive-first |
| Flow Integration | FCL (Flow Client Library) | Official SDK for wallet connection and transaction execution |
| Wallet Support | Flow Wallet, Blocto, Lilico | Three largest Flow wallets by user count |
| State Management | React Query (TanStack Query) | Caching, refetching, optimistic updates for on-chain data |
| Deployment | Vercel | Zero-config Next.js hosting |

### 6.2 Pages

**1. Landing Page (`/`)**
- Value proposition: "Borrow against your NFTs without selling them"
- How it works (3-step visual)
- Supported collections showcase
- Protocol stats (total loans, TVL) once live
- Connect wallet CTA

**2. Borrow Page (`/borrow`)**
- Requires wallet connection
- Displays user's NFTs grouped by whitelisted collection
- User selects NFTs to collateralize (checkbox multi-select)
- Real-time calculation of max borrow amount as selections change
- Loan configuration: amount slider (up to max), duration selector (7/14/30 days)
- Loan summary: principal, interest rate, total repayment amount, due date
- "Create Loan" button → triggers `create_loan` transaction
- Transaction status feedback (pending → confirmed → success)

**3. Dashboard (`/dashboard`)**
- Requires wallet connection
- Active loans list showing:
  - Loan ID
  - Collateral (NFT thumbnails + collection name)
  - Principal borrowed
  - Outstanding balance (real-time with accrued interest)
  - Time remaining (with urgency indicators: green → yellow → red)
  - Repay button
- Loan history (repaid and liquidated loans)
- Portfolio summary: total borrowed, total collateral value, total interest paid

**4. Repay Modal (overlay on Dashboard)**
- Shows loan details and outstanding balance
- Amount input (default: full repayment, option for partial)
- "Repay" button → triggers `repay_loan` transaction
- On full repayment: success state showing "Your NFTs are being returned"

**5. Collections Page (`/collections`)**
- All supported collections with floor prices and LTV ratios
- Per-collection stats: total loans, total collateral locked
- "Coming soon" section for collections under consideration

### 6.3 Key UX Principles

1. **No jargon**: Say "borrow" not "leverage". Say "deposit as collateral" not "collateralize". Say "your items" not "your NFTs" where possible.

2. **Transparent costs**: Show the exact repayment amount in FLOW and approximate USD before the user confirms. No hidden fees.

3. **Urgency without panic**: Loan expiry indicators should be clear (color-coded time remaining) but not anxiety-inducing. Send reminders, not threats.

4. **One happy path**: The borrow flow should be completable in 3 clicks after wallet connection: select NFTs → set amount/duration → confirm.

5. **Transaction feedback**: Every on-chain action shows a clear pending → confirmed → success/failure state. Link to Flowscan for the transaction.

---

## 7. Off-Chain Services

### 7.1 Floor Price Updater

A lightweight backend service that:
- Polls marketplace APIs (Flowverse, Top Shot marketplace, other aggregators) for NFT floor prices
- Compares against current on-chain floor prices
- Flags significant price movements for admin review
- Optionally auto-updates on-chain prices via admin transaction (with sanity checks: max % change per update, minimum update interval)

**Stack**: Simple Node.js cron job or serverless function (Vercel Cron). No database needed for MVP — state lives on-chain.

### 7.2 Loan Expiry Monitor

A service that:
- Watches for loans approaching expiry (24h, 6h, 1h warnings)
- Sends notifications to borrowers (email or push if available)
- Calls `liquidate_loan` for expired loans (acts as the default keeper)

**Stack**: Node.js service monitoring on-chain events + Flow Access API.

### 7.3 Event Indexer (Optional for MVP)

Indexes on-chain events for fast dashboard queries. For MVP, direct on-chain scripts may be sufficient. If performance becomes an issue, add a simple event indexer writing to a PostgreSQL database.

---

## 8. Security Considerations

### 8.1 Smart Contract Security

| Risk | Mitigation |
|------|-----------|
| Collateral theft | NFTs held in protocol-controlled resources with `access(contract)` functions only. No public withdrawal capability. |
| Treasury drain | Treasury withdrawals restricted to Admin resource (singleton, created at init). |
| Reentrancy | Cadence's resource model prevents reentrancy by design — resources can only exist in one place. |
| Flash loan attacks | Not applicable — no flash loans in MVP. |
| Integer overflow | Cadence uses UFix64 with built-in overflow protection. |
| Price manipulation | Admin-set prices with sanity checks. No on-chain oracle to manipulate. |
| Unauthorized admin actions | Admin resource is a singleton. Consider multi-sig for mainnet deployment. |

### 8.2 Economic Security

| Risk | Mitigation |
|------|-----------|
| NFT price crash | Conservative LTV ratios (20-40%) provide significant buffer. |
| Treasury insolvency | `create_loan` checks treasury balance before disbursing. If treasury < requested loan amount, transaction fails. Admin can `pause_protocol` to halt all new loans. Auto-pause triggers if treasury drops below 500 FLOW. |
| Mass defaults | Time-based forfeiture means protocol acquires NFTs as compensation. Protocol can sell forfeited NFTs to recover capital. |
| Admin key compromise | Multi-sig admin key management. Time-locked admin operations (V2). |

### 8.3 Pre-Mainnet Checklist

- [ ] Internal code review by Cadence-experienced developer
- [×] Testnet deployment and full lifecycle testing
- [ ] Professional security audit (Cadence-specialized firm)
- [ ] Economic simulation of edge cases (mass defaults, price crashes)
- [ ] Admin key management plan (multi-sig setup)
- [ ] Insurance or reserve fund for protocol risk

---

## 9. Success Metrics

### 9.1 Launch Metrics (First 30 Days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Total loans created | 100+ | On-chain event count |
| Total FLOW disbursed | 50,000+ FLOW | Treasury outflow |
| Unique borrowers | 50+ | Unique addresses in LoanCreated events |
| Repayment rate | >80% | Loans fully repaid / total matured loans |
| Average loan size | 50-500 FLOW | Mean of loan principals |
| Average loan duration | 14 days | Mean of selected durations |

### 9.2 Product Health Metrics (Ongoing)

| Metric | Healthy Signal |
|--------|---------------|
| Repeat borrower rate | >30% of borrowers create 2+ loans |
| Time-to-borrow | <3 minutes from wallet connect to loan creation |
| Liquidation rate | <20% of matured loans |
| Treasury utilization | 30-70% of treasury deployed in active loans |
| Revenue (interest earned) | Covers operational costs within 90 days |

### 9.3 North Star Metric

**Total Value Locked (TVL)** — the aggregate floor-price value of all NFTs currently held as collateral. This is the single number that represents protocol adoption, user trust, and market fit.

---

## 10. Rollout Plan

### Phase 1: Testnet
- Deploy contracts to Flow Testnet
- Internal testing of all transactions and scripts
- Frontend connected to testnet
- Invite 10-20 beta testers from Flow community
- Gate: All transaction types execute successfully; zero critical bugs in testing

### Phase 2: Guarded Mainnet
- Deploy to Flow Mainnet with conservative parameters:
  - Small treasury (5,000 FLOW)
  - 3 whitelisted collections only
  - Low max loan size (200 FLOW per loan)
  - Short max duration (7 days)
- Monitor closely, tune parameters based on real usage
- Gate: 20+ loans created with >80% repayment rate; no contract exploits

### Phase 3: Open Mainnet
- Increase treasury size based on demand
- Raise loan limits progressively
- Add more whitelisted collections
- Enable 14 and 30-day loan durations
- Begin community marketing and Flow ecosystem partnerships

---

## 11. Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| 1 | What marketplace APIs are available for Flow NFT floor prices? | Determines floor price update reliability | Engineering |
| 2 | Should partial collateral release be supported (e.g., release 1 of 3 NFTs on partial repayment)? | UX complexity vs. borrower flexibility | Product |
| 3 | What happens to forfeited NFTs? Sell on market, hold, or auction to community? | Revenue model and community perception | Product + Business |
| 4 | Should there be a grace period after loan expiry before forfeiture? | User friendliness vs. protocol risk | Product |
| 5 | What is the minimum viable treasury size for launch? | Determines fundraising/seed capital needs | Business |
| 6 | Legal structure: does this constitute a securities offering in any jurisdiction? | Determines launch geography and legal requirements | Legal |
| 7 | How do we handle Dapper Wallet users? (Dapper has custodial restrictions on NFT transfers) | May exclude a significant portion of NBA Top Shot holders | Engineering + Product |

---

## 12. Recommended Resolutions to Open Questions

The following are opinionated recommendations for each open question. These should be reviewed and confirmed by the relevant owner before implementation.

---

### Q1: Floor Price APIs for Flow NFTs

**Recommendation: Multi-source aggregation with Flowverse as primary.**

Use a tiered approach: Flowverse's public API as the primary source (it aggregates across the Flow ecosystem), supplemented by collection-specific marketplace APIs as secondary sources (Top Shot marketplace, NFL ALL DAY marketplace, Disney Pinnacle marketplace). Build a thin abstraction layer in the floor price updater service so sources can be swapped or weighted independently per collection. On each update cycle, compare Flowverse data against the collection-specific source; only auto-update on-chain if both sources agree within 10%. Flag significant divergences for manual admin review.

This avoids single-point-of-failure on any one data source and catches data quality issues before they reach the contract.

---

### Q2: Partial Collateral Release

**Recommendation: Defer to V2. All-or-nothing for MVP.**

Partial collateral release (e.g., returning 1 of 3 NFTs on partial repayment) requires tracking individual NFT values within a loan, deciding release ordering logic, and re-evaluating the remaining collateral ratio after each partial release. This meaningfully increases smart contract surface area and audit complexity with limited user benefit at MVP scale. The expected borrower behavior at launch is single-NFT loans or small bundles of equivalent items — the all-or-nothing model is acceptable. Add partial release in V2 once the user base and loan patterns are better understood.

---

### Q3: What Happens to Forfeited NFTs

**Recommendation: Hold in treasury initially; sell manually via marketplace when above protocol floor price.**

Immediately dumping forfeited NFTs risks depressing floor prices (bad for the ecosystem and for the protocol's own collateral valuations). Holding them indefinitely creates a bloated treasury with illiquid assets. The right balance: hold forfeited NFTs for a minimum of 7 days post-forfeiture, then sell via Flowverse or the relevant collection marketplace if the current floor price is at or above the floor price used for the original loan. If the floor has dropped significantly below the loan floor price, hold and re-evaluate weekly. Publish a forfeited NFT policy page on the protocol website for transparency. In V2, automate this via on-chain marketplace integration.

---

### Q4: Grace Period After Loan Expiry

**Recommendation: Yes — 24-hour grace period before collateral becomes eligible for forfeiture.**

A 24-hour grace period after loan expiry significantly improves user experience (timezone differences, missed notifications, short-term illiquidity) while adding minimal protocol risk given conservative LTV ratios. The keeper fee should still apply on forfeiture after the grace period to maintain liquidator incentives. Implementation: `liquidate(loanID)` reverts if called within 24 hours of expiry. The Loan Expiry Monitor sends a final urgent notification at expiry-time, and again at expiry + 20 hours. This change also reduces the liquidation rate metric, which directly improves protocol reputation.

---

### Q5: Minimum Viable Treasury Size

**Recommendation: 10,000 FLOW at launch.**

Working backwards: target 30 concurrent active loans in Phase 2, average loan size of 150 FLOW, treasury utilization ceiling of 70% (keeping 30% as a liquidity buffer). Required treasury = (30 × 150) / 0.70 = ~6,430 FLOW. Round up to 10,000 FLOW to account for growth headroom and to maintain the auto-pause threshold of 500 FLOW as a meaningful floor. At current FLOW prices this is a manageable seed capital requirement. Treasury can be grown organically as interest income accumulates and loan volume grows — no need to fundraise beyond the initial 10,000 FLOW bootstrap.

---

### Q6: Legal Structure

**Recommendation: Consult a crypto-specialized attorney before mainnet launch. Operate from a non-US entity. Apply US geo-restriction on the frontend as a precaution.**

The core protocol — lending FLOW tokens against NFT collateral at a fixed rate — does not obviously constitute a securities offering under the Howey Test (no investment contract, no common enterprise, no expectation of profit from others' efforts). However, the regulatory landscape for DeFi lending is rapidly evolving and jurisdiction-dependent. Recommended actions before mainnet:

1. Engage a crypto-specialized legal firm (e.g., Fenwick & West, Debevoise & Plimpton) for a jurisdiction analysis.
2. Establish the protocol entity in a crypto-friendly jurisdiction (e.g., Cayman Islands, BVI, or Switzerland).
3. Implement a frontend geo-restriction blocking US IP addresses at launch, adding them back only after legal clearance.
4. Publish a clear Terms of Service explicitly excluding users in restricted jurisdictions.

The NFTs themselves (Top Shot moments, etc.) are collectibles, not securities, which simplifies the collateral side of the analysis.

---

### Q7: Dapper Wallet Users

**Recommendation: Do not support Dapper Wallet natively at launch. Provide a clear migration guide to non-custodial wallets.**

Dapper Wallet is fully custodial — Dapper Labs controls the keys, which means NFT transfers out of Dapper require Dapper's explicit technical support. Getting a native Dapper integration built and approved before MVP launch is unrealistic. The pragmatic path:

- **At launch**: Publish a prominent "Migrate from Dapper" guide showing users how to transfer their NFTs from Dapper Wallet to Blocto or Flow Wallet. This migration is supported by both Dapper and the receiving wallets. It takes ~10 minutes.
- **On the Borrow page**: If a user connects with Dapper Wallet, show a clear message explaining the limitation and link directly to the migration guide rather than showing a broken experience.
- **Longer-term**: Engage Dapper Labs directly about a Moments Money partnership. Given that Moments Money unlocks liquidity for Top Shot holders (which benefits Dapper's retention), there is a mutual incentive for Dapper to support a native integration.

The migration guide will exclude some fraction of casual users, but early adopters willing to migrate are likely the most engaged and valuable users anyway.

---

## 13. Appendix: User Flow Diagrams

### Borrow Flow
```
User opens app
  → Connects Flow wallet
  → Sees their NFTs (filtered to whitelisted collections)
  → Selects 1+ NFTs from same collection
  → Sees max borrow amount update in real-time
  → Adjusts borrow amount (slider or input)
  → Selects loan duration (7 / 14 / 30 days)
  → Reviews summary (principal, interest, total repayment, due date)
  → Clicks "Borrow"
  → Approves transaction in wallet
  → Sees pending state
  → Transaction confirmed
  → FLOW appears in wallet
  → Redirected to dashboard with active loan visible
```

### Repay Flow
```
User opens dashboard
  → Sees active loan with outstanding balance and time remaining
  → Clicks "Repay"
  → Repay modal opens with pre-filled full repayment amount
  → (Optional) Adjusts to partial repayment amount
  → Reviews repayment summary
  → Clicks "Confirm Repayment"
  → Approves transaction in wallet
  → Transaction confirmed
  → If full repayment: NFTs returned, loan marked "Repaid"
  → If partial: Outstanding balance updated, loan remains active
```

### Liquidation Flow (Automated)
```
Loan expiry monitor detects expired loan
  → Calls liquidate_loan transaction
  → Collateral NFTs transferred to protocol treasury
  → Loan marked "Liquidated"
  → LoanLiquidated event emitted
  → Dashboard updates for borrower (loan status: "Forfeited")
```

---

*End of PRD v1.0*
