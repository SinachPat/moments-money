// MomentsMoney_test.cdc
// Cadence test suite for the MomentsMoney protocol
// Run with: flow test ./tests/MomentsMoney_test.cdc

import Test
import BlockchainHelpers
import "MomentsMoney"

// ─── TEST ACCOUNTS ────────────────────────────────────────────────────────────

access(all) let blockchain = Test.newEmulatorBlockchain()
// deployer is the protocol account that holds Admin, LoanManager, and MockMoment
access(all) let deployer = blockchain.createAccount()
access(all) let borrowerAccount = blockchain.createAccount()
access(all) let keeperAccount = blockchain.createAccount()

// ─── CONSTANTS (mirrors contract values for assertions) ───────────────────────

access(all) let NBA_TOP_SHOT_ID = "A.0b2a3299cc857e29.TopShot.NFT"
access(all) let FLOOR_PRICE: UFix64 = 500.0
access(all) let LTV_RATIO: UFix64 = 0.40
access(all) let INTEREST_RATE: UFix64 = 0.15
access(all) let SEVEN_DAYS: UFix64 = 604800.0
access(all) let THIRTY_DAYS: UFix64 = 2592000.0
access(all) let FOURTEEN_DAYS: UFix64 = 1209600.0   // 14 × 86400
access(all) let SECONDS_PER_YEAR: UFix64 = 31536000.0  // 365 × 86400

// MockMoment paths (known from MockMoment.cdc)
access(all) let MOCK_STORAGE_PATH: StoragePath = /storage/MockMomentCollection
access(all) let MOCK_PUBLIC_PATH: PublicPath = /public/MockMomentCollection

// ─── SETUP ────────────────────────────────────────────────────────────────────

access(all) fun setup() {
    // Configure emulator contract addresses to match flow.json emulator network.
    // "MockMoment" resolves to the same deployer account as "MomentsMoney".
    blockchain.useConfiguration(Test.Configuration(
        addresses: {
            "FungibleToken":              "0xee82856bf20e2aa6",
            "NonFungibleToken":           "0xf8d6e0586b0a20c7",
            "FlowToken":                  "0x0ae53cb6e3f42a79",
            "MetadataViews":              "0xf8d6e0586b0a20c7",
            "FungibleTokenMetadataViews": "0xee82856bf20e2aa6",
            "MomentsMoney":               deployer.address.toString(),
            "MockMoment":                 deployer.address.toString()
        }
    ))

    // Deploy MomentsMoney to the deployer account
    let contractCode = Test.readFile("../contracts/MomentsMoney.cdc")
    let err = blockchain.deployContract(
        name: "MomentsMoney",
        code: contractCode,
        account: deployer,
        arguments: []
    )
    Test.expect(err, Test.beNil())

    // Deploy MockMoment to the same deployer account (testnet-only mock NFT)
    let mockCode = Test.readFile("../contracts/MockMoment.cdc")
    let mockErr = blockchain.deployContract(
        name: "MockMoment",
        code: mockCode,
        account: deployer,
        arguments: []
    )
    Test.expect(mockErr, Test.beNil())
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Build the MockMoment NFT type identifier from the deployer's address.
// address.toString() → "0x1234..." → strip "0x" → "A.1234....MockMoment.NFT"
access(all) fun getMockMomentCollectionID(): String {
    let addrStr = deployer.address.toString()
    let hex = addrStr.slice(from: 2, upTo: addrStr.length)
    return "A.".concat(hex).concat(".MockMoment.NFT")
}

// ─── INITIALIZATION TESTS ─────────────────────────────────────────────────────

access(all) fun testContractInitialization() {
    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    Test.expect(result, Test.beSucceeded())

    let stats = result.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(stats.totalLoans, 0 as UInt64)
    Test.assertEqual(stats.activeLoans, 0 as UInt64)
    Test.assertEqual(stats.isPaused, false)
    Test.assertEqual(stats.treasuryBalance, 0.0 as UFix64)
    Test.assertEqual(stats.totalFlowDisbursed, 0.0 as UFix64)
    Test.assertEqual(stats.totalInterestEarned, 0.0 as UFix64)
}

access(all) fun testNoCollectionsInitially() {
    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_all_collections.cdc"),
        [deployer.address]
    )
    Test.expect(result, Test.beSucceeded())

    let collections = result.returnValue! as! [MomentsMoney.CollectionConfig]
    Test.assertEqual(collections.length, 0)
}

// ─── COLLECTION MANAGEMENT TESTS ─────────────────────────────────────────────

access(all) fun testAddCollection() {
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/add_collection.cdc"),
        [
            NBA_TOP_SHOT_ID,
            "NBA Top Shot",
            FLOOR_PRICE,
            LTV_RATIO,
            INTEREST_RATE,
            THIRTY_DAYS,
            1 as UInt8
        ],
        [deployer]
    )
    Test.expect(txResult, Test.beSucceeded())

    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_collection_config.cdc"),
        [deployer.address, NBA_TOP_SHOT_ID]
    )
    Test.expect(result, Test.beSucceeded())

    let config = result.returnValue as! MomentsMoney.CollectionConfig?
    Test.assert(config != nil, message: "Collection should be present after addCollection")
    Test.assertEqual(config!.floorPrice, FLOOR_PRICE)
    Test.assertEqual(config!.ltvRatio, LTV_RATIO)
    Test.assertEqual(config!.interestRate, INTEREST_RATE)
    Test.assertEqual(config!.isActive, true)
    Test.assertEqual(config!.tier, 1 as UInt8)
}

access(all) fun testAddCollectionFailsForNonAdmin() {
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/add_collection.cdc"),
        [
            "A.some.Other.NFT",
            "Other Collection",
            100.0 as UFix64,
            0.30 as UFix64,
            INTEREST_RATE,
            SEVEN_DAYS,
            2 as UInt8
        ],
        [borrowerAccount]  // Wrong signer — should fail
    )
    Test.expect(txResult, Test.beFailed())
}

access(all) fun testAddDuplicateCollectionFails() {
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/add_collection.cdc"),
        [
            NBA_TOP_SHOT_ID,  // Already added in testAddCollection
            "NBA Top Shot Duplicate",
            FLOOR_PRICE,
            LTV_RATIO,
            INTEREST_RATE,
            THIRTY_DAYS,
            1 as UInt8
        ],
        [deployer]
    )
    Test.expect(txResult, Test.beFailed())
}

access(all) fun testUpdateCollectionFloorPrice() {
    let newPrice: UFix64 = 750.0
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [
            NBA_TOP_SHOT_ID,
            newPrice,  // floorPrice
            nil,       // ltvRatio — unchanged
            nil,       // interestRate — unchanged
            nil,       // maxLoanDuration — unchanged
            nil        // isActive — unchanged
        ],
        [deployer]
    )
    Test.expect(txResult, Test.beSucceeded())

    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_collection_config.cdc"),
        [deployer.address, NBA_TOP_SHOT_ID]
    )
    let config = (result.returnValue as! MomentsMoney.CollectionConfig?)!
    Test.assertEqual(config.floorPrice, newPrice)
    Test.assertEqual(config.ltvRatio, LTV_RATIO, message: "LTV should be unchanged")
}

access(all) fun testDeactivateCollection() {
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [NBA_TOP_SHOT_ID, nil, nil, nil, nil, false],
        [deployer]
    )
    Test.expect(txResult, Test.beSucceeded())

    // Inactive collection should return 0 max borrow
    let scriptResult = blockchain.executeScript(
        Test.readFile("../scripts/get_max_borrow_amount.cdc"),
        [deployer.address, NBA_TOP_SHOT_ID, 1 as UInt64]
    )
    Test.assertEqual(scriptResult.returnValue! as! UFix64, 0.0 as UFix64)

    // Re-activate for subsequent tests
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [NBA_TOP_SHOT_ID, nil, nil, nil, nil, true],
        [deployer]
    )
}

// ─── MAX BORROW CALCULATION TESTS ────────────────────────────────────────────

access(all) fun testGetMaxBorrowAmount() {
    // Reset floor price to 500.0 in case previous tests changed it
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [NBA_TOP_SHOT_ID, FLOOR_PRICE, nil, nil, nil, nil],
        [deployer]
    )

    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_max_borrow_amount.cdc"),
        [deployer.address, NBA_TOP_SHOT_ID, 2 as UInt64]
    )
    Test.expect(result, Test.beSucceeded())

    let maxBorrow = result.returnValue! as! UFix64
    // 2 NFTs × 500 FLOW floor × 0.40 LTV = 400 FLOW
    Test.assertEqual(maxBorrow, 400.0 as UFix64)
}

access(all) fun testGetMaxBorrowForUnknownCollectionIsZero() {
    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_max_borrow_amount.cdc"),
        [deployer.address, "A.nonexistent.Contract.NFT", 5 as UInt64]
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(result.returnValue! as! UFix64, 0.0 as UFix64)
}

// ─── PROTOCOL PAUSE TESTS ─────────────────────────────────────────────────────

access(all) fun testPauseAndUnpause() {
    let pauseResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/pause_protocol.cdc"),
        [],
        [deployer]
    )
    Test.expect(pauseResult, Test.beSucceeded())

    let statsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    let stats = statsResult.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(stats.isPaused, true)

    let unpauseResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/unpause_protocol.cdc"),
        [],
        [deployer]
    )
    Test.expect(unpauseResult, Test.beSucceeded())

    let statsAfterResult = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    let statsAfter = statsAfterResult.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(statsAfter.isPaused, false)
}

// ─── TREASURY TESTS ───────────────────────────────────────────────────────────

access(all) fun testDepositTreasury() {
    let depositAmount: UFix64 = 10000.0
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/deposit_treasury.cdc"),
        [depositAmount],
        [deployer]
    )
    Test.expect(txResult, Test.beSucceeded())

    let balanceResult = blockchain.executeScript(
        Test.readFile("../scripts/get_treasury_balance.cdc"),
        [deployer.address]
    )
    Test.expect(balanceResult, Test.beSucceeded())
    Test.assertEqual(balanceResult.returnValue! as! UFix64, depositAmount)
}

// ─── INTEREST CALCULATION TESTS (pure math) ──────────────────────────────────
// Validates: totalInterest = principal × rate × durationSeconds / (365 × 24 × 3600)

access(all) fun testInterestCalculation() {
    let principal: UFix64 = 100.0
    let rate: UFix64 = 0.15      // 15% APR
    let duration: UFix64 = SEVEN_DAYS
    // 100 × 0.15 × 604800 / 31536000 ≈ 2.877 FLOW
    let expectedInterest = principal * rate * duration / (365.0 * 24.0 * 3600.0)
    Test.assert(expectedInterest > 0.0, message: "Interest should be positive")
    Test.assert(expectedInterest < principal, message: "7-day interest should be well below principal")
}

access(all) fun testInterestCalculation_14days() {
    // Formula: principal × annualRate × (durationSeconds / SECONDS_PER_YEAR)
    // 100.0 × 0.15 × 1209600.0 / 31536000.0
    // = 18144000.0 / 31536000.0 = 0.57534246 (UFix64 truncation)
    let principal: UFix64 = 100.0
    let rate: UFix64 = 0.15

    let interest = principal * rate * FOURTEEN_DAYS / SECONDS_PER_YEAR
    Test.assertEqual(interest, 0.57534246 as UFix64,
        message: "14-day interest at 15% APR on 100 FLOW should be 0.57534246 FLOW")
    Test.assert(interest > 0.5 as UFix64,
        message: "Interest must be > 0.5 FLOW")
    Test.assert(interest < 1.0 as UFix64,
        message: "Interest on 100 FLOW at 15% for 14 days must be < 1 FLOW")
}

access(all) fun testInterestCalculation_capsAtDuration() {
    // MomentsMoney charges FIXED total interest based on the loan's full duration,
    // not elapsed time. The outstanding balance = totalRepayment - repaidAmount,
    // and totalRepayment is computed once at loan creation.
    // Verify: 100 FLOW × 5% APR × 30 days = 0.41095890 FLOW
    let principal: UFix64 = 100.0
    let rate: UFix64 = 0.05   // MockMoment interest rate

    let fixedInterest = principal * rate * THIRTY_DAYS / SECONDS_PER_YEAR
    Test.assertEqual(fixedInterest, 0.41095890 as UFix64,
        message: "30-day 5% APR interest on 100 FLOW should be 0.41095890 FLOW")

    let totalRepayment = principal + fixedInterest
    Test.assertEqual(totalRepayment, 100.41095890 as UFix64,
        message: "Total repayment = principal + fixed interest")

    // A 14-day loan at the same rate accrues less interest than 30 days:
    let interest14 = principal * rate * FOURTEEN_DAYS / SECONDS_PER_YEAR
    Test.assert(interest14 < fixedInterest,
        message: "14-day interest should be less than 30-day interest at the same rate")
}

// ─── LOAN LIFECYCLE — SETUP ────────────────────────────────────────────────────

access(all) fun testCreateLoanFailsWhenProtocolPaused() {
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/pause_protocol.cdc"),
        [],
        [deployer]
    )

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [1 as UInt64],
            NBA_TOP_SHOT_ID,
            "/storage/momentCollection" as StoragePath,
            "/public/momentReceiver" as PublicPath,
            200.0 as UFix64,
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed())

    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/unpause_protocol.cdc"),
        [],
        [deployer]
    )
}

access(all) fun testGetLoanInfoReturnsNilForNonExistentLoan() {
    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 999 as UInt64]
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(result.returnValue as! MomentsMoney.LoanInfo?, nil)
}

access(all) fun testGetActiveLoansReturnsEmptyForNoLoans() {
    let result = blockchain.executeScript(
        Test.readFile("../scripts/get_active_loans_by_address.cdc"),
        [deployer.address, borrowerAccount.address]
    )
    Test.expect(result, Test.beSucceeded())

    let loans = result.returnValue! as! [MomentsMoney.LoanInfo]
    Test.assertEqual(loans.length, 0)
}

// ─── MOCK MOMENT SETUP FOR LOAN LIFECYCLE TESTS ───────────────────────────────

access(all) fun testRegisterMockMomentAndSetupBorrower() {
    let mockMomentID = getMockMomentCollectionID()

    // 1. Register MockMoment as accepted collateral (floor 10 FLOW, 70% LTV, 5% APR, 30d)
    let addTx = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/add_collection.cdc"),
        [
            mockMomentID,
            "Mock Moment (Test)",
            10.0 as UFix64,       // floor price
            0.70 as UFix64,       // LTV ratio
            0.05 as UFix64,       // 5% APR
            THIRTY_DAYS,          // 30-day max duration
            2 as UInt8            // tier
        ],
        [deployer]
    )
    Test.expect(addTx, Test.beSucceeded())

    // 2. Set up borrower's collection and mint 5 NFTs via test helper transaction
    let mintTx = blockchain.executeTransaction(
        Test.readFile("../transactions/public/setup_mock_moment_collection.cdc"),
        [deployer.address, 5 as Int],
        [borrowerAccount]
    )
    Test.expect(mintTx, Test.beSucceeded())

    // 3. Verify borrower received NFTs
    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    Test.expect(idsResult, Test.beSucceeded())
    let ids = idsResult.returnValue! as! [UInt64]
    Test.assert(ids.length >= 2, message: "Borrower should have at least 2 MockMoment NFTs for tests")
}

// ─── LOAN CREATION TESTS ──────────────────────────────────────────────────────

access(all) fun testCreateLoan_insufficientTreasury() {
    // Treasury has 10,000 FLOW. Set a very high floor price so the loan amount
    // passes the LTV check but exceeds the treasury balance.
    // floor = 15,000 → max = 15,000 × 0.70 = 10,500 FLOW → try borrow 10,001 FLOW.
    let mockMomentID = getMockMomentCollectionID()
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, 15000.0 as UFix64, nil, nil, nil, nil],
        [deployer]
    )

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]],
            mockMomentID,
            MOCK_STORAGE_PATH,
            MOCK_PUBLIC_PATH,
            10001.0 as UFix64,   // exceeds treasury (10,000 FLOW)
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Loan creation should fail when borrow amount exceeds treasury balance")

    // Restore floor price to 10 FLOW
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, 10.0 as UFix64, nil, nil, nil, nil],
        [deployer]
    )
}

access(all) fun testCreateLoan_exceedsLTV() {
    // floor = 10 FLOW, LTV = 0.70 → max for 1 NFT = 7 FLOW. Try 8 FLOW → fails.
    let mockMomentID = getMockMomentCollectionID()

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]],
            mockMomentID,
            MOCK_STORAGE_PATH,
            MOCK_PUBLIC_PATH,
            8.0 as UFix64,   // exceeds max (7 FLOW)
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Loan creation should fail when borrow amount exceeds LTV-allowed maximum")
}

access(all) fun testCreateLoan_inactiveCollection() {
    let mockMomentID = getMockMomentCollectionID()

    // Temporarily deactivate MockMoment collection
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, nil, nil, nil, nil, false],
        [deployer]
    )

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]],
            mockMomentID,
            MOCK_STORAGE_PATH,
            MOCK_PUBLIC_PATH,
            5.0 as UFix64,
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Loan creation should fail for an inactive collection")

    // Re-activate for subsequent tests
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, nil, nil, nil, nil, true],
        [deployer]
    )
}

access(all) fun testCreateLoan_nftTypeMismatch() {
    // Deposit a MockMoment NFT but claim it is NBA_TOP_SHOT_ID.
    // Before the fix, the contract trusted the caller-supplied identifier and would
    // disburse up to 500 × 0.40 = 200 FLOW for a 10-FLOW-floor NFT.
    // After the fix, the runtime type check fires immediately.
    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    Test.assert(allIDs.length > 0, message: "Borrower needs an NFT for type-mismatch test")

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]],
            NBA_TOP_SHOT_ID,     // lying about the collection — NFT is actually MockMoment
            MOCK_STORAGE_PATH,   // borrow from the real MockMoment collection
            MOCK_PUBLIC_PATH,
            5.0 as UFix64,
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Loan creation must fail when deposited NFT type does not match collectionIdentifier")
}

access(all) fun testCreateLoan_success() {
    // Happy path: 1 NFT at 10 FLOW floor, borrow 5 FLOW (≤ max 7 FLOW).
    // Loan #1 is created here and used in subsequent repayment tests.
    let mockMomentID = getMockMomentCollectionID()

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    Test.assert(allIDs.length > 0, message: "Borrower must have at least one NFT")
    let nftID = allIDs[0]

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [nftID],
            mockMomentID,
            MOCK_STORAGE_PATH,
            MOCK_PUBLIC_PATH,
            5.0 as UFix64,   // borrow 5 FLOW (max = 7 FLOW)
            SEVEN_DAYS,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Loan creation should succeed with valid collateral and borrow amount")

    // Verify loan #1 was created with correct parameters
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 1 as UInt64]
    )
    Test.expect(loanResult, Test.beSucceeded())
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanInfo.principal, 5.0 as UFix64)
    Test.assertEqual(loanInfo.status, MomentsMoney.LoanStatus.Active)
    Test.assertEqual(loanInfo.nftIDs.length, 1)
    Test.assertEqual(loanInfo.repaidAmount, 0.0 as UFix64)
    Test.assert(loanInfo.outstandingBalance > 0.0 as UFix64,
        message: "Outstanding balance should include principal + interest")
}

access(all) fun testCreateLoan_incrementsCounters() {
    // Verify protocol-wide counters incremented after loan #1 creation
    let statsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    let stats = statsResult.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(stats.totalLoans, 1 as UInt64,
        message: "totalLoans should be 1 after first loan")
    Test.assertEqual(stats.totalFlowDisbursed, 5.0 as UFix64,
        message: "totalFlowDisbursed should be 5 FLOW after first loan")
    Test.assertEqual(stats.activeLoans, 1 as UInt64,
        message: "activeLoans should be 1")
    Test.assertEqual(stats.totalInterestEarned, 0.0 as UFix64,
        message: "Interest is earned only on repayment — should still be 0")
}

// ─── REPAYMENT TESTS ──────────────────────────────────────────────────────────
// Loan #1 is active: 5 FLOW principal, 5% APR, 7-day term.

access(all) fun testRepayLoan_partial() {
    // Partial repayment: 1 FLOW. Loan stays Active, NFTs remain locked.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [
            1 as UInt64,       // loan #1
            1.0 as UFix64,     // repay 1 FLOW
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Partial repayment should succeed")

    // Loan should remain Active with updated repaidAmount
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 1 as UInt64]
    )
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanInfo.status, MomentsMoney.LoanStatus.Active,
        message: "Loan should remain Active after partial payment")
    Test.assertEqual(loanInfo.repaidAmount, 1.0 as UFix64,
        message: "repaidAmount should reflect the 1 FLOW partial payment")
}

access(all) fun testOutstandingBalance_afterPartialRepay() {
    // After 1 FLOW payment on loan #1, outstanding should be reduced.
    // totalRepayment = 5 + (5 × 0.05 × 604800 / 31536000) = 5 + 0.00479452 ≈ 5.00479452 FLOW
    // outstanding = 5.00479452 - 1.0 = 4.00479452 FLOW (approximately)
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 1 as UInt64]
    )
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!

    Test.assert(loanInfo.outstandingBalance < loanInfo.totalRepayment,
        message: "Outstanding balance should be less than totalRepayment after partial payment")
    Test.assert(loanInfo.outstandingBalance > 0.0 as UFix64,
        message: "Outstanding balance should still be positive after partial repayment")
    Test.assert(loanInfo.outstandingBalance < 5.0 as UFix64,
        message: "Outstanding should be less than original principal after 1 FLOW payment")
}

access(all) fun testRepayLoan_full() {
    // Pay the exact outstanding balance to fully repay loan #1.
    // NFTs should be returned to borrower.
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 1 as UInt64]
    )
    let loanBefore = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!
    let outstanding = loanBefore.outstandingBalance

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [
            1 as UInt64,
            outstanding,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Full repayment should succeed")

    // Loan should now be Repaid with zero outstanding balance
    let afterResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 1 as UInt64]
    )
    let loanAfter = (afterResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanAfter.status, MomentsMoney.LoanStatus.Repaid,
        message: "Loan should be Repaid after full payment")
    Test.assertEqual(loanAfter.outstandingBalance, 0.0 as UFix64,
        message: "Outstanding balance should be 0 after full repayment")

    // Protocol should record interest earned
    let statsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    let stats = statsResult.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(stats.activeLoans, 0 as UInt64,
        message: "Active loans should be 0 after full repayment")
    Test.assert(stats.totalInterestEarned > 0.0 as UFix64,
        message: "Interest earned should be recorded after full repayment")
}

access(all) fun testRepayLoan_exactAmount() {
    // Create fresh loan #2, then pay totalRepayment in a single transaction.
    let mockMomentID = getMockMomentCollectionID()

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    Test.assert(allIDs.length > 0, message: "Borrower needs at least one NFT for loan #2")

    // Create loan #2
    let createResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]], mockMomentID,
            MOCK_STORAGE_PATH, MOCK_PUBLIC_PATH,
            5.0 as UFix64, SEVEN_DAYS, deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(createResult, Test.beSucceeded())

    // Get exact totalRepayment (principal + fixed interest)
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 2 as UInt64]
    )
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!

    // Pay the exact totalRepayment amount in one shot
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [
            2 as UInt64,
            loanInfo.totalRepayment,
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Single repayment of exact totalRepayment should fully close the loan")

    let afterResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 2 as UInt64]
    )
    let loanAfter = (afterResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanAfter.status, MomentsMoney.LoanStatus.Repaid,
        message: "Loan #2 should be Repaid after paying exact outstanding amount")
}

access(all) fun testRepayLoan_thirdPartyCanMakePartialPayment() {
    // The NFT return destination is locked in at loan creation, so anyone can safely
    // contribute a partial payment without being able to steal the collateral.
    // This test: keeperAccount makes a 1 FLOW partial payment toward loan #3.
    // Loan stays active (collateral remains locked), repaidAmount increases by 1.
    let mockMomentID = getMockMomentCollectionID()

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    Test.assert(allIDs.length > 0, message: "Borrower needs a NFT for loan #3")

    blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]], mockMomentID,
            MOCK_STORAGE_PATH, MOCK_PUBLIC_PATH,
            5.0 as UFix64, SEVEN_DAYS, deployer.address
        ],
        [borrowerAccount]
    )

    // keeperAccount makes a 1 FLOW partial payment — this should now succeed.
    // NFT collateral stays locked (partial payment only). Loan remains Active.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [3 as UInt64, 1.0 as UFix64, deployer.address],
        [keeperAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "A third party should be able to make a partial payment toward any active loan")

    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 3 as UInt64]
    )
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanInfo.status, MomentsMoney.LoanStatus.Active,
        message: "Loan #3 should stay Active after partial payment by a third party")
    Test.assertEqual(loanInfo.repaidAmount, 1.0 as UFix64,
        message: "repaidAmount should reflect the 1 FLOW payment")
}

// ─── LIQUIDATION TESTS ────────────────────────────────────────────────────────
// Loan #3 is active (5 FLOW, 7-day term) and not yet expired.

access(all) fun testLiquidation_notEligible() {
    // Loan #3 was just created — it has not expired. Liquidation should fail.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/public/liquidate_loan.cdc"),
        [3 as UInt64, deployer.address],
        [keeperAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Liquidation should fail when loan has not expired yet")
}

access(all) fun testLiquidation_withinGracePeriod() {
    // Advance time to just past loan expiry but still within the 24-hour grace period.
    // Jump: SEVEN_DAYS + 12 hours (43200 seconds). Loan #3 expired but grace period active.
    blockchain.moveTime(by: SEVEN_DAYS + 43200.0)

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/public/liquidate_loan.cdc"),
        [3 as UInt64, deployer.address],
        [keeperAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Liquidation should fail when loan is expired but within the 24-hour grace period")
}

access(all) fun testLiquidation_eligible() {
    // Advance time past the grace period (24 hours + 1 second).
    // Total time elapsed from loan start: SEVEN_DAYS + 43200 + GRACE_PERIOD + 1 second.
    blockchain.moveTime(by: MomentsMoney.GRACE_PERIOD + 1.0)

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/public/liquidate_loan.cdc"),
        [3 as UInt64, deployer.address],
        [keeperAccount]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Liquidation should succeed after loan expiry + grace period")

    // Loan #3 should now be Liquidated
    let loanResult = blockchain.executeScript(
        Test.readFile("../scripts/get_loan_info.cdc"),
        [deployer.address, 3 as UInt64]
    )
    let loanInfo = (loanResult.returnValue as! MomentsMoney.LoanInfo?)!
    Test.assertEqual(loanInfo.status, MomentsMoney.LoanStatus.Liquidated,
        message: "Loan should be Liquidated after successful liquidation")
}

access(all) fun testLiquidation_alreadyRepaid() {
    // Loan #2 was fully repaid in testRepayLoan_exactAmount. Liquidating it should fail.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/public/liquidate_loan.cdc"),
        [2 as UInt64, deployer.address],
        [keeperAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Liquidation should fail when the loan has already been repaid")
}

// ─── AUTO-PAUSE TEST ──────────────────────────────────────────────────────────

access(all) fun testAutoPauseOnLowTreasury() {
    // Ensure protocol starts unpaused
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/unpause_protocol.cdc"),
        [], [deployer]
    )

    // Get current treasury balance and withdraw enough to leave exactly 600 FLOW.
    // Creating a 200 FLOW loan will reduce treasury to ~400 FLOW (< 500 threshold).
    let balResult = blockchain.executeScript(
        Test.readFile("../scripts/get_treasury_balance.cdc"),
        [deployer.address]
    )
    let currentBalance = balResult.returnValue! as! UFix64
    let withdrawAmount = currentBalance - 600.0

    if withdrawAmount > 0.0 {
        let withdrawTx = blockchain.executeTransaction(
            Test.readFile("../transactions/admin/withdraw_treasury.cdc"),
            [withdrawAmount],
            [deployer]
        )
        Test.expect(withdrawTx, Test.beSucceeded())
    }

    // Temporarily update MockMoment floor price so 200 FLOW is valid under LTV.
    // floor = 300 FLOW → max = 300 × 0.70 = 210 FLOW → 200 FLOW loan is valid.
    let mockMomentID = getMockMomentCollectionID()
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, 300.0 as UFix64, nil, nil, nil, nil],
        [deployer]
    )

    // Ensure borrower has NFTs for this loan
    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    let hasFreshNFTs = allIDs.length > 0

    if !hasFreshNFTs {
        blockchain.executeTransaction(
            Test.readFile("../transactions/public/setup_mock_moment_collection.cdc"),
            [deployer.address, 5 as Int],
            [borrowerAccount]
        )
    }

    let freshIDsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let freshIDs = freshIDsResult.returnValue! as! [UInt64]
    Test.assert(freshIDs.length > 0, message: "Borrower needs an NFT for auto-pause test")

    // Create a 200 FLOW loan — treasury drops from 600 to ~400 FLOW (< 500 threshold)
    let createResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [freshIDs[0]], mockMomentID,
            MOCK_STORAGE_PATH, MOCK_PUBLIC_PATH,
            200.0 as UFix64, SEVEN_DAYS, deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(createResult, Test.beSucceeded())

    // Protocol should now be auto-paused (treasury < AUTO_PAUSE_THRESHOLD = 500)
    let statsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_protocol_stats.cdc"),
        [deployer.address]
    )
    let stats = statsResult.returnValue! as! MomentsMoney.ProtocolStats
    Test.assertEqual(stats.isPaused, true,
        message: "Protocol should auto-pause when treasury drops below 500 FLOW")
    Test.assert(stats.treasuryBalance < 500.0 as UFix64,
        message: "Treasury should be below 500 FLOW threshold when auto-paused")

    // Restore state for any following tests
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/unpause_protocol.cdc"), [], [deployer]
    )
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/update_collection.cdc"),
        [mockMomentID, 10.0 as UFix64, nil, nil, nil, nil], [deployer]
    )
}

// ─── COLLECTION DEACTIVATION TEST ────────────────────────────────────────────

access(all) fun testRemoveCollectionDeactivatesOnly() {
    let tempID = "A.temporary.TestCollection.NFT"
    blockchain.executeTransaction(
        Test.readFile("../transactions/admin/add_collection.cdc"),
        [tempID, "Temp", 100.0 as UFix64, 0.30 as UFix64, INTEREST_RATE, SEVEN_DAYS, 3 as UInt8],
        [deployer]
    )

    let removeResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/remove_collection.cdc"),
        [tempID],
        [deployer]
    )
    Test.expect(removeResult, Test.beSucceeded())

    // Record is preserved but isActive = false
    let scriptResult = blockchain.executeScript(
        Test.readFile("../scripts/get_collection_config.cdc"),
        [deployer.address, tempID]
    )
    let config = scriptResult.returnValue as! MomentsMoney.CollectionConfig?
    Test.assert(config != nil, message: "Deactivated collection record should still exist")
    Test.assertEqual(config!.isActive, false)

    // Max borrow should be 0 for deactivated collection
    let borrowResult = blockchain.executeScript(
        Test.readFile("../scripts/get_max_borrow_amount.cdc"),
        [deployer.address, tempID, 1 as UInt64]
    )
    Test.assertEqual(borrowResult.returnValue! as! UFix64, 0.0 as UFix64)
}

access(all) fun testDeactivateNonExistentCollectionFails() {
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/remove_collection.cdc"),
        ["A.does.not.Exist"],
        [deployer]
    )
    Test.expect(txResult, Test.beFailed())
}

// ─── FORFEITED NFT WITHDRAWAL TESTS ──────────────────────────────────────────
// Loan #3 was liquidated in testLiquidation_eligible.
// Its collateral NFT now lives in the protocol's forfeitedVaults dictionary.

access(all) fun testWithdrawForfeitedNFTs_success() {
    // deployer (admin) withdraws the single NFT from loan #3's forfeited vault
    // into their own MockMoment collection (set up in MockMoment.init()).
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/withdraw_forfeited_nfts.cdc"),
        [3 as UInt64, MOCK_PUBLIC_PATH],
        [deployer]
    )
    Test.expect(txResult, Test.beSucceeded(),
        message: "Admin should be able to withdraw forfeited collateral from a liquidated loan")

    // Deployer's collection should now contain the recovered NFT
    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [deployer.address]
    )
    Test.expect(idsResult, Test.beSucceeded())
    let ids = idsResult.returnValue! as! [UInt64]
    Test.assert(ids.length > 0,
        message: "Deployer's collection should hold the recovered NFT after withdrawal")
}

access(all) fun testWithdrawForfeitedNFTs_nonAdmin() {
    // borrowerAccount has no Admin resource — the transaction panics in prepare().
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/withdraw_forfeited_nfts.cdc"),
        [3 as UInt64, MOCK_PUBLIC_PATH],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Non-admin should not be able to withdraw forfeited NFTs")
}

access(all) fun testWithdrawForfeitedNFTs_noVault() {
    // Loan #1 was fully *repaid* — its collateral was returned to the borrower,
    // so there is no forfeited vault for loan #1. The contract panics.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/admin/withdraw_forfeited_nfts.cdc"),
        [1 as UInt64, MOCK_PUBLIC_PATH],
        [deployer]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Withdrawing from a non-forfeited loan ID should fail")
}

// ─── LOAN DURATION VALIDATION TEST ───────────────────────────────────────────

access(all) fun testCreateLoan_durationExceedsMax() {
    // MockMoment collection has maxLoanDuration = THIRTY_DAYS (2592000s).
    // Requesting THIRTY_DAYS + 1 second should be rejected.
    let mockMomentID = getMockMomentCollectionID()

    let idsResult = blockchain.executeScript(
        Test.readFile("../scripts/get_nft_ids.cdc"),
        [borrowerAccount.address]
    )
    let allIDs = idsResult.returnValue! as! [UInt64]
    Test.assert(allIDs.length > 0, message: "Borrower needs an NFT for duration test")

    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/create_loan.cdc"),
        [
            [allIDs[0]],
            mockMomentID,
            MOCK_STORAGE_PATH,
            MOCK_PUBLIC_PATH,
            5.0 as UFix64,
            THIRTY_DAYS + 1.0,   // 1 second past the max
            deployer.address
        ],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Loan creation should fail when duration exceeds collection's maxLoanDuration")
}

// ─── REPAYING A CLOSED LOAN TESTS ─────────────────────────────────────────────

access(all) fun testRepayLoan_onRepaidLoan() {
    // Loan #1 is Repaid. Any repayment attempt should fail with "Loan is not active".
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [1 as UInt64, 0.01 as UFix64, deployer.address],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Repaying an already-repaid loan should fail")
}

access(all) fun testRepayLoan_onLiquidatedLoan() {
    // Loan #3 is Liquidated. Repayment should fail — collateral is already forfeited.
    let txResult = blockchain.executeTransaction(
        Test.readFile("../transactions/borrower/repay_loan.cdc"),
        [3 as UInt64, 0.01 as UFix64, deployer.address],
        [borrowerAccount]
    )
    Test.expect(txResult, Test.beFailed(),
        message: "Repaying a liquidated loan should fail")
}

// ─── CONSTANTS VERIFICATION ───────────────────────────────────────────────────

access(all) fun testProtocolConstants() {
    Test.assertEqual(MomentsMoney.KEEPER_FEE, 1.0 as UFix64,
        message: "Keeper fee must be 1 FLOW")
    Test.assertEqual(MomentsMoney.GRACE_PERIOD, 86400.0 as UFix64,
        message: "Grace period must be 24 hours (86400s)")
    Test.assertEqual(MomentsMoney.AUTO_PAUSE_THRESHOLD, 500.0 as UFix64,
        message: "Auto-pause threshold must be 500 FLOW")
}
