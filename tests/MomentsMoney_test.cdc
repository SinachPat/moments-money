// MomentsMoney_test.cdc
// Cadence test suite for the MomentsMoney protocol
// Run with: flow test ./tests/MomentsMoney_test.cdc

import Test
import BlockchainHelpers
import "MomentsMoney"

// ─── TEST ACCOUNTS ────────────────────────────────────────────────────────────

access(all) let blockchain = Test.newEmulatorBlockchain()
// deployer is the protocol account that holds Admin and LoanManager
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

// ─── SETUP ────────────────────────────────────────────────────────────────────

access(all) fun setup() {
    // Configure emulator contract addresses to match flow.json emulator network
    blockchain.useConfiguration(Test.Configuration(
        addresses: {
            "FungibleToken":              "0xee82856bf20e2aa6",
            "NonFungibleToken":           "0xf8d6e0586b0a20c7",
            "FlowToken":                  "0x0ae53cb6e3f42a79",
            "MetadataViews":              "0xf8d6e0586b0a20c7",
            "FungibleTokenMetadataViews": "0xee82856bf20e2aa6"
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

// ─── LOAN LIFECYCLE TESTS ─────────────────────────────────────────────────────

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

    // Returns [LoanInfo], not [UInt64]
    let loans = result.returnValue! as! [MomentsMoney.LoanInfo]
    Test.assertEqual(loans.length, 0)
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

// ─── CONSTANTS VERIFICATION ───────────────────────────────────────────────────

access(all) fun testProtocolConstants() {
    Test.assertEqual(MomentsMoney.KEEPER_FEE, 1.0 as UFix64,
        message: "Keeper fee must be 1 FLOW")
    Test.assertEqual(MomentsMoney.GRACE_PERIOD, 86400.0 as UFix64,
        message: "Grace period must be 24 hours (86400s)")
    Test.assertEqual(MomentsMoney.AUTO_PAUSE_THRESHOLD, 500.0 as UFix64,
        message: "Auto-pause threshold must be 500 FLOW")
}
