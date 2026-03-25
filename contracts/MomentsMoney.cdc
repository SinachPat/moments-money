// MomentsMoney.cdc
// NFT-backed micro-lending protocol on Flow
// Cadence 1.0 — post-Crescendo upgrade

import "FungibleToken"
import "NonFungibleToken"
import "FlowToken"

access(all) contract MomentsMoney {

    // ─── CONSTANTS ────────────────────────────────────────────────────────────

    // Fixed keeper fee paid to liquidation caller from treasury
    access(all) let KEEPER_FEE: UFix64
    // 24-hour grace period after loan expiry before liquidation is permitted
    access(all) let GRACE_PERIOD: UFix64
    // Treasury balance threshold that triggers auto-pause of new loans
    access(all) let AUTO_PAUSE_THRESHOLD: UFix64

    // ─── STORAGE PATHS ───────────────────────────────────────────────────────

    access(all) let LoanManagerStoragePath: StoragePath
    access(all) let LoanManagerPublicPath: PublicPath
    access(all) let AdminStoragePath: StoragePath

    // ─── CONTRACT STATE ──────────────────────────────────────────────────────

    // Monotonically increasing loan ID counter (starts at 1)
    access(all) var nextLoanID: UInt64
    // Halts new loan creation when true; existing loans unaffected
    access(all) var isPaused: Bool
    // Whitelisted NFT collections keyed by collection identifier
    access(contract) var collections: {String: CollectionConfig}
    // Aggregate protocol statistics updated on every state change
    access(all) var totalLoans: UInt64
    access(all) var totalFlowDisbursed: UFix64
    access(all) var totalInterestEarned: UFix64

    // ─── EVENTS ──────────────────────────────────────────────────────────────

    access(all) event LoanCreated(
        loanID: UInt64,
        borrower: Address,
        principal: UFix64,
        interestRate: UFix64,
        duration: UFix64,
        collectionIdentifier: String,
        nftIDs: [UInt64]
    )
    access(all) event LoanRepayment(
        loanID: UInt64,
        borrower: Address,
        amount: UFix64,
        remainingBalance: UFix64
    )
    access(all) event LoanFullyRepaid(
        loanID: UInt64,
        borrower: Address,
        totalInterestPaid: UFix64
    )
    access(all) event LoanLiquidated(
        loanID: UInt64,
        borrower: Address,
        outstandingDebt: UFix64,
        collateralNFTIDs: [UInt64]
    )
    access(all) event CollateralDeposited(
        loanID: UInt64,
        collectionIdentifier: String,
        nftIDs: [UInt64]
    )
    access(all) event CollateralReturned(
        loanID: UInt64,
        borrower: Address,
        nftIDs: [UInt64]
    )
    access(all) event CollectionAdded(
        identifier: String,
        floorPrice: UFix64,
        ltvRatio: UFix64
    )
    access(all) event CollectionUpdated(
        identifier: String,
        floorPrice: UFix64,
        ltvRatio: UFix64
    )
    access(all) event CollectionRemoved(identifier: String)
    access(all) event TreasuryDeposit(amount: UFix64)
    access(all) event TreasuryWithdrawal(amount: UFix64)
    access(all) event ProtocolPaused()
    access(all) event ProtocolUnpaused()

    // ─── ENUMS ───────────────────────────────────────────────────────────────

    access(all) enum LoanStatus: UInt8 {
        access(all) case Active
        access(all) case Repaid
        access(all) case Liquidated
    }

    // ─── STRUCTS ─────────────────────────────────────────────────────────────

    access(all) struct CollectionConfig {
        access(all) let collectionIdentifier: String
        access(all) let displayName: String
        access(all) var floorPrice: UFix64
        access(all) var ltvRatio: UFix64
        // Annual simple interest rate, e.g. 0.15 = 15% APR
        access(all) var interestRate: UFix64
        // Maximum loan duration in seconds
        access(all) var maxLoanDuration: UFix64
        access(all) var isActive: Bool
        // 1 = Tier 1 (highest LTV), 3 = Tier 3 (lowest LTV)
        access(all) let tier: UInt8

        init(
            collectionIdentifier: String,
            displayName: String,
            floorPrice: UFix64,
            ltvRatio: UFix64,
            interestRate: UFix64,
            maxLoanDuration: UFix64,
            isActive: Bool,
            tier: UInt8
        ) {
            self.collectionIdentifier = collectionIdentifier
            self.displayName = displayName
            self.floorPrice = floorPrice
            self.ltvRatio = ltvRatio
            self.interestRate = interestRate
            self.maxLoanDuration = maxLoanDuration
            self.isActive = isActive
            self.tier = tier
        }
    }

    // Read-only snapshot of a loan for use in scripts and frontend queries
    access(all) struct LoanInfo {
        access(all) let id: UInt64
        access(all) let borrower: Address
        access(all) let principal: UFix64
        access(all) let interestRate: UFix64
        access(all) let startTime: UFix64
        access(all) let duration: UFix64
        access(all) let expiryTime: UFix64
        access(all) let collectionIdentifier: String
        access(all) let nftIDs: [UInt64]
        access(all) let repaidAmount: UFix64
        access(all) let outstandingBalance: UFix64
        access(all) let totalRepayment: UFix64
        access(all) let status: LoanStatus
        access(all) let isExpired: Bool
        access(all) let isInGracePeriod: Bool
        access(all) let isEligibleForLiquidation: Bool

        init(
            id: UInt64,
            borrower: Address,
            principal: UFix64,
            interestRate: UFix64,
            startTime: UFix64,
            duration: UFix64,
            expiryTime: UFix64,
            collectionIdentifier: String,
            nftIDs: [UInt64],
            repaidAmount: UFix64,
            outstandingBalance: UFix64,
            totalRepayment: UFix64,
            status: LoanStatus,
            isExpired: Bool,
            isInGracePeriod: Bool,
            isEligibleForLiquidation: Bool
        ) {
            self.id = id
            self.borrower = borrower
            self.principal = principal
            self.interestRate = interestRate
            self.startTime = startTime
            self.duration = duration
            self.expiryTime = expiryTime
            self.collectionIdentifier = collectionIdentifier
            self.nftIDs = nftIDs
            self.repaidAmount = repaidAmount
            self.outstandingBalance = outstandingBalance
            self.totalRepayment = totalRepayment
            self.status = status
            self.isExpired = isExpired
            self.isInGracePeriod = isInGracePeriod
            self.isEligibleForLiquidation = isEligibleForLiquidation
        }
    }

    access(all) struct ProtocolStats {
        access(all) let totalLoans: UInt64
        access(all) let activeLoans: UInt64
        access(all) let totalFlowDisbursed: UFix64
        access(all) let totalInterestEarned: UFix64
        access(all) let treasuryBalance: UFix64
        access(all) let isPaused: Bool

        init(
            totalLoans: UInt64,
            activeLoans: UInt64,
            totalFlowDisbursed: UFix64,
            totalInterestEarned: UFix64,
            treasuryBalance: UFix64,
            isPaused: Bool
        ) {
            self.totalLoans = totalLoans
            self.activeLoans = activeLoans
            self.totalFlowDisbursed = totalFlowDisbursed
            self.totalInterestEarned = totalInterestEarned
            self.treasuryBalance = treasuryBalance
            self.isPaused = isPaused
        }
    }

    // ─── COLLATERAL VAULT ─────────────────────────────────────────────────────

    // Holds the NFTs deposited as collateral for a single loan.
    // Only contract-level code (LoanManager) can deposit or withdraw NFTs.
    access(all) resource CollateralVault {
        access(self) var nfts: @{UInt64: {NonFungibleToken.NFT}}

        // Deposit a single NFT. Panics if an NFT with the same ID already exists.
        access(contract) fun deposit(nft: @{NonFungibleToken.NFT}) {
            let id = nft.id
            self.nfts[id] <-! nft
        }

        // Withdraw all NFTs at once. Returns an ordered array.
        access(contract) fun withdrawAll(): @[{NonFungibleToken.NFT}] {
            var result: @[{NonFungibleToken.NFT}] <- []
            let ids = self.nfts.keys
            for id in ids {
                let nft <- self.nfts.remove(key: id)!
                result.append(<- nft)
            }
            return <- result
        }

        access(all) view fun getNFTIDs(): [UInt64] {
            return self.nfts.keys
        }

        access(all) view fun getCount(): Int {
            return self.nfts.length
        }

        init() {
            self.nfts <- {}
        }

        destroy() {
            // All code paths must withdraw NFTs before destroying a vault.
            // This destroy is only reached on emergency contract removal.
            destroy self.nfts
        }
    }

    // ─── LOAN RESOURCE ────────────────────────────────────────────────────────

    // Immutable record of a loan's terms plus mutable repayment tracking.
    // Lives inside LoanManager.loans — never leaves the protocol.
    access(all) resource Loan {
        access(all) let id: UInt64
        access(all) let borrower: Address
        access(all) let principal: UFix64
        // Annual simple interest rate, e.g. 0.15 = 15% APR
        access(all) let interestRate: UFix64
        access(all) let startTime: UFix64
        // Fixed duration in seconds (e.g. 7 days = 604800)
        access(all) let duration: UFix64
        access(all) let collectionIdentifier: String
        access(all) let nftIDs: [UInt64]
        access(all) var repaidAmount: UFix64
        access(all) var status: LoanStatus

        // ── Computed views ──

        access(all) view fun getExpiryTime(): UFix64 {
            return self.startTime + self.duration
        }

        // Total interest charged over the full fixed duration:
        //   principal × annualRate × (durationSeconds / secondsPerYear)
        access(all) view fun getTotalInterest(): UFix64 {
            return self.principal * self.interestRate * self.duration / (365.0 * 24.0 * 3600.0)
        }

        access(all) view fun getTotalRepayment(): UFix64 {
            return self.principal + self.getTotalInterest()
        }

        access(all) view fun getOutstandingBalance(): UFix64 {
            let total = self.getTotalRepayment()
            if self.repaidAmount >= total {
                return 0.0
            }
            return total - self.repaidAmount
        }

        // ── Mutators (contract-only) ──

        access(contract) fun recordRepayment(amount: UFix64) {
            self.repaidAmount = self.repaidAmount + amount
        }

        access(contract) fun markRepaid() {
            self.status = LoanStatus.Repaid
        }

        access(contract) fun markLiquidated() {
            self.status = LoanStatus.Liquidated
        }

        init(
            id: UInt64,
            borrower: Address,
            principal: UFix64,
            interestRate: UFix64,
            duration: UFix64,
            collectionIdentifier: String,
            nftIDs: [UInt64]
        ) {
            self.id = id
            self.borrower = borrower
            self.principal = principal
            self.interestRate = interestRate
            self.startTime = getCurrentBlock().timestamp
            self.duration = duration
            self.collectionIdentifier = collectionIdentifier
            self.nftIDs = nftIDs
            self.repaidAmount = 0.0
            self.status = LoanStatus.Active
        }
    }

    // ─── LOAN MANAGER PUBLIC INTERFACE ───────────────────────────────────────

    access(all) resource interface LoanManagerPublic {
        access(all) view fun getLoanInfo(loanID: UInt64): LoanInfo?
        access(all) view fun getActiveLoans(borrower: Address): [LoanInfo]
        access(all) view fun getCollectionConfig(identifier: String): CollectionConfig?
        access(all) view fun getAllCollections(): [CollectionConfig]
        access(all) view fun getMaxBorrowAmount(identifier: String, nftCount: UInt64): UFix64
        access(all) view fun getOutstandingBalance(loanID: UInt64): UFix64
        access(all) view fun getTreasuryBalance(): UFix64
        access(all) view fun getProtocolStats(): ProtocolStats

        access(all) fun createLoan(
            nfts: @[{NonFungibleToken.NFT}],
            collectionIdentifier: String,
            borrowAmount: UFix64,
            duration: UFix64,
            borrower: Address,
            flowReceiverCap: Capability<&{FungibleToken.Receiver}>,
            nftReturnReceiverCap: Capability<&{NonFungibleToken.Receiver}>
        )

        access(all) fun repayLoan(
            loanID: UInt64,
            payment: @{FungibleToken.Vault},
            nftReceiverCap: Capability<&{NonFungibleToken.Receiver}>
        )

        access(all) fun liquidateLoan(
            loanID: UInt64,
            keeperFlowReceiverCap: Capability<&{FungibleToken.Receiver}>
        )
    }

    // ─── LOAN MANAGER RESOURCE ────────────────────────────────────────────────

    // Core protocol resource. Holds the treasury, all active/closed loans,
    // collateral vaults, and forfeited collateral from liquidated loans.
    // Stored as a singleton at LoanManagerStoragePath.
    access(all) resource LoanManager: LoanManagerPublic {
        access(self) var loans: @{UInt64: Loan}
        access(self) var collateralVaults: @{UInt64: CollateralVault}
        // Collateral from liquidated loans, keyed by loanID to avoid NFT ID
        // collisions across different collections
        access(self) var forfeitedVaults: @{UInt64: CollateralVault}
        access(self) var treasury: @{FungibleToken.Vault}
        // Index: borrower address -> [loanIDs] for O(1) dashboard queries
        access(self) var borrowerLoans: {Address: [UInt64]}

        // ── Read-only public methods ──────────────────────────────────────────

        access(all) view fun getTreasuryBalance(): UFix64 {
            return self.treasury.balance
        }

        access(all) view fun getCollectionConfig(identifier: String): CollectionConfig? {
            return MomentsMoney.collections[identifier]
        }

        access(all) view fun getAllCollections(): [CollectionConfig] {
            return MomentsMoney.collections.values
        }

        access(all) view fun getMaxBorrowAmount(identifier: String, nftCount: UInt64): UFix64 {
            let config = MomentsMoney.collections[identifier]
            if config == nil || !config!.isActive { return 0.0 }
            return config!.floorPrice * config!.ltvRatio * UFix64(nftCount)
        }

        access(all) view fun getOutstandingBalance(loanID: UInt64): UFix64 {
            let loanRef = &self.loans[loanID] as &Loan?
            if loanRef == nil { return 0.0 }
            return loanRef!.getOutstandingBalance()
        }

        access(all) view fun getLoanInfo(loanID: UInt64): LoanInfo? {
            let loanRef = &self.loans[loanID] as &Loan?
            if loanRef == nil { return nil }
            let loan = loanRef!
            let now = getCurrentBlock().timestamp
            let expiry = loan.getExpiryTime()
            let outstanding = loan.getOutstandingBalance()
            let expired = now > expiry
            let gracePeriodEnd = expiry + MomentsMoney.GRACE_PERIOD
            return LoanInfo(
                id: loan.id,
                borrower: loan.borrower,
                principal: loan.principal,
                interestRate: loan.interestRate,
                startTime: loan.startTime,
                duration: loan.duration,
                expiryTime: expiry,
                collectionIdentifier: loan.collectionIdentifier,
                nftIDs: loan.nftIDs,
                repaidAmount: loan.repaidAmount,
                outstandingBalance: outstanding,
                totalRepayment: loan.getTotalRepayment(),
                status: loan.status,
                isExpired: expired,
                isInGracePeriod: expired && now <= gracePeriodEnd,
                isEligibleForLiquidation: loan.status == LoanStatus.Active
                    && now > gracePeriodEnd
                    && outstanding > 0.0
            )
        }

        access(all) view fun getActiveLoans(borrower: Address): [LoanInfo] {
            let ids = self.borrowerLoans[borrower]
            if ids == nil { return [] }
            var activeLoans: [LoanInfo] = []
            for id in ids! {
                let loanRef = &self.loans[id] as &Loan?
                if loanRef != nil && loanRef!.status == LoanStatus.Active {
                    if let info = self.getLoanInfo(loanID: id) {
                        activeLoans.append(info)
                    }
                }
            }
            return activeLoans
        }

        access(all) view fun getProtocolStats(): ProtocolStats {
            var activeCount: UInt64 = 0
            for id in self.loans.keys {
                let loanRef = &self.loans[id] as &Loan?
                if loanRef != nil && loanRef!.status == LoanStatus.Active {
                    activeCount = activeCount + 1
                }
            }
            return ProtocolStats(
                totalLoans: MomentsMoney.totalLoans,
                activeLoans: activeCount,
                totalFlowDisbursed: MomentsMoney.totalFlowDisbursed,
                totalInterestEarned: MomentsMoney.totalInterestEarned,
                treasuryBalance: self.treasury.balance,
                isPaused: MomentsMoney.isPaused
            )
        }

        // ── Borrower actions ──────────────────────────────────────────────────

        // Deposit NFTs as collateral and receive FLOW tokens.
        // Pre-conditions cover protocol state; collection-specific
        // validations are assertions inside the body since they depend
        // on dictionary lookups performed after the pre block.
        access(all) fun createLoan(
            nfts: @[{NonFungibleToken.NFT}],
            collectionIdentifier: String,
            borrowAmount: UFix64,
            duration: UFix64,
            borrower: Address,
            flowReceiverCap: Capability<&{FungibleToken.Receiver}>,
            nftReturnReceiverCap: Capability<&{NonFungibleToken.Receiver}>
        ) {
            pre {
                !MomentsMoney.isPaused: "Protocol is paused — no new loans at this time"
                nfts.length > 0: "Must deposit at least one NFT"
                borrowAmount > 0.0: "Borrow amount must be positive"
                duration > 0.0: "Duration must be positive"
                flowReceiverCap.check(): "Invalid FLOW receiver capability"
                nftReturnReceiverCap.check(): "Invalid NFT return capability — ensure your collection is set up"
            }

            let config = MomentsMoney.collections[collectionIdentifier]
                ?? panic("Collection is not whitelisted: ".concat(collectionIdentifier))

            assert(config.isActive, message: "Collection is not accepting new loans")
            assert(duration <= config.maxLoanDuration,
                message: "Requested duration exceeds maximum for this collection")

            let maxBorrow = config.floorPrice * config.ltvRatio * UFix64(nfts.length)
            assert(borrowAmount <= maxBorrow,
                message: "Borrow amount exceeds maximum allowed for deposited collateral")
            assert(self.treasury.balance >= borrowAmount,
                message: "Insufficient treasury balance — try a smaller amount")

            // Snapshot NFT IDs before taking ownership of the array
            let nftIDs: [UInt64] = []
            var idx = 0
            while idx < nfts.length {
                nftIDs.append(nfts[idx].id)
                idx = idx + 1
            }

            // Assign loan ID and advance the counter
            let loanID = MomentsMoney.nextLoanID
            MomentsMoney.nextLoanID = MomentsMoney.nextLoanID + 1

            // Build collateral vault from deposited NFTs
            let vault <- create CollateralVault()
            while nfts.length > 0 {
                vault.deposit(nft: <- nfts.remove(at: 0))
            }
            destroy nfts

            let loan <- create Loan(
                id: loanID,
                borrower: borrower,
                principal: borrowAmount,
                interestRate: config.interestRate,
                duration: duration,
                collectionIdentifier: collectionIdentifier,
                nftIDs: nftIDs
            )
            self.loans[loanID] <-! loan
            self.collateralVaults[loanID] <-! vault

            // Update borrower index for dashboard lookups
            if self.borrowerLoans[borrower] == nil {
                self.borrowerLoans[borrower] = [loanID]
            } else {
                self.borrowerLoans[borrower]!.append(loanID)
            }

            // Disburse FLOW to borrower
            let loanFunds <- self.treasury.withdraw(amount: borrowAmount)
            flowReceiverCap.borrow()!.deposit(from: <- loanFunds)

            MomentsMoney.totalLoans = MomentsMoney.totalLoans + 1
            MomentsMoney.totalFlowDisbursed = MomentsMoney.totalFlowDisbursed + borrowAmount

            emit CollateralDeposited(
                loanID: loanID,
                collectionIdentifier: collectionIdentifier,
                nftIDs: nftIDs
            )
            emit LoanCreated(
                loanID: loanID,
                borrower: borrower,
                principal: borrowAmount,
                interestRate: config.interestRate,
                duration: duration,
                collectionIdentifier: collectionIdentifier,
                nftIDs: nftIDs
            )

            // Auto-pause when treasury drops below the safety threshold
            if self.treasury.balance < MomentsMoney.AUTO_PAUSE_THRESHOLD {
                MomentsMoney.isPaused = true
                emit ProtocolPaused()
            }
        }

        // Send a FLOW payment against an active loan.
        // Partial payments reduce outstanding balance but do not release collateral.
        // Full payment returns all collateral NFTs to the nftReceiverCap address.
        access(all) fun repayLoan(
            loanID: UInt64,
            payment: @{FungibleToken.Vault},
            nftReceiverCap: Capability<&{NonFungibleToken.Receiver}>
        ) {
            pre {
                payment.balance > 0.0: "Payment must be positive"
                nftReceiverCap.check(): "Invalid NFT receiver capability"
            }

            let loanRef = &self.loans[loanID] as &Loan?
                ?? panic("Loan not found")

            assert(loanRef.status == LoanStatus.Active, message: "Loan is not active")
            assert(payment.balance <= loanRef.getOutstandingBalance(),
                message: "Payment exceeds outstanding balance — query the current balance first")

            let paymentAmount = payment.balance
            let remainingAfter = loanRef.getOutstandingBalance() - paymentAmount

            self.treasury.deposit(from: <- payment)
            loanRef.recordRepayment(amount: paymentAmount)

            emit LoanRepayment(
                loanID: loanID,
                borrower: loanRef.borrower,
                amount: paymentAmount,
                remainingBalance: remainingAfter
            )

            // Full repayment — close the loan and return all collateral
            if remainingAfter == 0.0 {
                let totalInterestPaid = loanRef.getTotalInterest()
                let borrowerAddr = loanRef.borrower
                loanRef.markRepaid()

                MomentsMoney.totalInterestEarned = MomentsMoney.totalInterestEarned + totalInterestPaid

                let vault <- self.collateralVaults.remove(key: loanID)!
                let nftIDs = vault.getNFTIDs()
                let nfts <- vault.withdrawAll()
                destroy vault

                let receiver = nftReceiverCap.borrow()!
                while nfts.length > 0 {
                    receiver.deposit(token: <- nfts.remove(at: 0))
                }
                destroy nfts

                emit LoanFullyRepaid(
                    loanID: loanID,
                    borrower: borrowerAddr,
                    totalInterestPaid: totalInterestPaid
                )
                emit CollateralReturned(
                    loanID: loanID,
                    borrower: borrowerAddr,
                    nftIDs: nftIDs
                )
            }
        }

        // Trigger forfeiture on an expired loan past the grace period.
        // The caller receives a fixed KEEPER_FEE from the treasury as incentive.
        // Anyone can call this — the incentive is the keeper fee.
        access(all) fun liquidateLoan(
            loanID: UInt64,
            keeperFlowReceiverCap: Capability<&{FungibleToken.Receiver}>
        ) {
            pre {
                keeperFlowReceiverCap.check(): "Invalid keeper FLOW receiver capability"
            }

            let loanRef = &self.loans[loanID] as &Loan?
                ?? panic("Loan not found")

            assert(loanRef.status == LoanStatus.Active, message: "Loan is not active")
            assert(loanRef.getOutstandingBalance() > 0.0, message: "Loan has been fully repaid")
            assert(
                getCurrentBlock().timestamp > loanRef.getExpiryTime() + MomentsMoney.GRACE_PERIOD,
                message: "Loan is still within the grace period"
            )
            assert(self.treasury.balance >= MomentsMoney.KEEPER_FEE,
                message: "Insufficient treasury to pay keeper fee")

            let outstandingDebt = loanRef.getOutstandingBalance()
            let collateralIDs = loanRef.nftIDs
            let borrowerAddr = loanRef.borrower
            loanRef.markLiquidated()

            // Move the collateral vault to forfeited storage
            let vault <- self.collateralVaults.remove(key: loanID)!
            self.forfeitedVaults[loanID] <-! vault

            let keeperFee <- self.treasury.withdraw(amount: MomentsMoney.KEEPER_FEE)
            keeperFlowReceiverCap.borrow()!.deposit(from: <- keeperFee)

            emit LoanLiquidated(
                loanID: loanID,
                borrower: borrowerAddr,
                outstandingDebt: outstandingDebt,
                collateralNFTIDs: collateralIDs
            )
        }

        // ── Admin-gated methods ───────────────────────────────────────────────
        // Accept a &Admin reference as proof of admin identity.
        // Admin is stored at a private path — only the deployer can produce this ref.

        access(all) fun depositToTreasury(adminRef: &Admin, funds: @{FungibleToken.Vault}) {
            let amount = funds.balance
            self.treasury.deposit(from: <- funds)
            emit TreasuryDeposit(amount: amount)
        }

        access(all) fun withdrawFromTreasury(adminRef: &Admin, amount: UFix64): @{FungibleToken.Vault} {
            pre {
                self.treasury.balance >= amount: "Insufficient treasury balance"
            }
            emit TreasuryWithdrawal(amount: amount)
            return <- self.treasury.withdraw(amount: amount)
        }

        // Withdraw all NFTs from a specific liquidated loan's forfeited vault.
        access(all) fun withdrawForfeitedVault(adminRef: &Admin, loanID: UInt64): @[{NonFungibleToken.NFT}] {
            let vault <- self.forfeitedVaults.remove(key: loanID)
                ?? panic("No forfeited vault for loan ".concat(loanID.toString()))
            let nfts <- vault.withdrawAll()
            destroy vault
            return <- nfts
        }

        access(all) view fun getForfeitedLoanIDs(adminRef: &Admin): [UInt64] {
            return self.forfeitedVaults.keys
        }

        init(treasury: @{FungibleToken.Vault}) {
            self.loans <- {}
            self.collateralVaults <- {}
            self.forfeitedVaults <- {}
            self.treasury <- treasury
            self.borrowerLoans = {}
        }

        destroy() {
            destroy self.loans
            destroy self.collateralVaults
            destroy self.forfeitedVaults
            destroy self.treasury
        }
    }

    // ─── ADMIN RESOURCE ───────────────────────────────────────────────────────

    // Singleton resource for protocol governance.
    // Stored at AdminStoragePath — only the deployer account can borrow it.
    access(all) resource Admin {

        access(all) fun addCollection(
            collectionIdentifier: String,
            displayName: String,
            floorPrice: UFix64,
            ltvRatio: UFix64,
            interestRate: UFix64,
            maxLoanDuration: UFix64,
            tier: UInt8
        ) {
            pre {
                MomentsMoney.collections[collectionIdentifier] == nil:
                    "Collection already whitelisted — use updateCollection to modify"
                floorPrice > 0.0: "Floor price must be positive"
                ltvRatio > 0.0 && ltvRatio <= 1.0: "LTV ratio must be between 0 and 1"
                interestRate > 0.0 && interestRate <= 1.0: "Interest rate must be between 0 and 1"
                maxLoanDuration > 0.0: "Max duration must be positive"
                tier >= 1 && tier <= 3: "Tier must be 1, 2, or 3"
            }

            MomentsMoney.collections[collectionIdentifier] = CollectionConfig(
                collectionIdentifier: collectionIdentifier,
                displayName: displayName,
                floorPrice: floorPrice,
                ltvRatio: ltvRatio,
                interestRate: interestRate,
                maxLoanDuration: maxLoanDuration,
                isActive: true,
                tier: tier
            )

            emit CollectionAdded(
                identifier: collectionIdentifier,
                floorPrice: floorPrice,
                ltvRatio: ltvRatio
            )
        }

        // Selectively update collection parameters. Pass nil to leave a field unchanged.
        access(all) fun updateCollection(
            collectionIdentifier: String,
            floorPrice: UFix64?,
            ltvRatio: UFix64?,
            interestRate: UFix64?,
            maxLoanDuration: UFix64?,
            isActive: Bool?
        ) {
            // Structs are value types — copy out, mutate, replace in the dict
            var config = MomentsMoney.collections[collectionIdentifier]
                ?? panic("Collection not found: ".concat(collectionIdentifier))

            if let fp = floorPrice {
                assert(fp > 0.0, message: "Floor price must be positive")
                config.floorPrice = fp
            }
            if let ltv = ltvRatio {
                assert(ltv > 0.0 && ltv <= 1.0, message: "LTV ratio must be between 0 and 1")
                config.ltvRatio = ltv
            }
            if let ir = interestRate {
                assert(ir > 0.0 && ir <= 1.0, message: "Interest rate must be between 0 and 1")
                config.interestRate = ir
            }
            if let mld = maxLoanDuration {
                assert(mld > 0.0, message: "Max duration must be positive")
                config.maxLoanDuration = mld
            }
            if let active = isActive {
                config.isActive = active
            }

            MomentsMoney.collections[collectionIdentifier] = config

            emit CollectionUpdated(
                identifier: collectionIdentifier,
                floorPrice: config.floorPrice,
                ltvRatio: config.ltvRatio
            )
        }

        // Deactivates a collection — no new loans accepted, existing loans unaffected.
        // Does not delete the record so history is preserved and re-activation is possible.
        access(all) fun deactivateCollection(collectionIdentifier: String) {
            var config = MomentsMoney.collections[collectionIdentifier]
                ?? panic("Collection not found: ".concat(collectionIdentifier))
            config.isActive = false
            MomentsMoney.collections[collectionIdentifier] = config
            emit CollectionRemoved(identifier: collectionIdentifier)
        }

        access(all) fun pauseProtocol() {
            MomentsMoney.isPaused = true
            emit ProtocolPaused()
        }

        access(all) fun unpauseProtocol() {
            MomentsMoney.isPaused = false
            emit ProtocolUnpaused()
        }
    }

    // ─── CONTRACT-LEVEL GETTERS ───────────────────────────────────────────────
    // Convenience for scripts that only need collection data without borrowing
    // the full LoanManager capability.

    access(all) view fun getCollectionConfig(identifier: String): CollectionConfig? {
        return self.collections[identifier]
    }

    access(all) view fun getAllCollections(): [CollectionConfig] {
        return self.collections.values
    }

    // ─── INITIALIZER ─────────────────────────────────────────────────────────

    init() {
        self.KEEPER_FEE = 1.0
        self.GRACE_PERIOD = 86400.0        // 24 hours in seconds
        self.AUTO_PAUSE_THRESHOLD = 500.0  // auto-pause below 500 FLOW treasury

        self.LoanManagerStoragePath = /storage/momentsMoneyLoanManager
        self.LoanManagerPublicPath = /public/momentsMoneyLoanManager
        self.AdminStoragePath = /storage/momentsMoneyAdmin

        self.nextLoanID = 1
        self.isPaused = false
        self.collections = {}
        self.totalLoans = 0
        self.totalFlowDisbursed = 0.0
        self.totalInterestEarned = 0.0

        // Create LoanManager with an empty FLOW treasury vault
        let treasury <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        let manager <- create LoanManager(treasury: <- treasury)
        self.account.storage.save(<- manager, to: self.LoanManagerStoragePath)

        // Public capability exposes only the LoanManagerPublic interface —
        // admin-gated methods and internal state are not reachable via this cap
        let managerCap = self.account.capabilities.storage.issue<&{LoanManagerPublic}>(
            self.LoanManagerStoragePath
        )
        self.account.capabilities.publish(managerCap, at: self.LoanManagerPublicPath)

        // Admin singleton — only the deployer account can borrow this
        self.account.storage.save(<- create Admin(), to: self.AdminStoragePath)
    }
}
