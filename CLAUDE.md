# CLAUDE.md — Cadence & Flow Reference for Moments Money

> This file is the authoritative Cadence language reference for Claude Code when building the Moments Money DeFi lending protocol on the Flow blockchain. Read this before generating ANY Cadence code, transactions, or scripts.

---

## PROJECT CONTEXT

**Product**: Moments Money — NFT-backed micro-lending protocol on Flow
**Smart Contract Language**: Cadence 1.0 (resource-oriented, launched with Crescendo upgrade, Sept 4 2024)
**Target Chain**: Flow Mainnet
**Token Standards**: FungibleToken V2, NonFungibleToken V2
**Key Dependencies**: FungibleToken, NonFungibleToken, MetadataViews, FungibleTokenMetadataViews, FlowToken

---

## CADENCE 1.0 — CRITICAL RULES

These are **non-negotiable**. Violating any of these will produce broken or deprecated code.

### 1. Resource-Oriented Programming
Cadence uses **linear types** (resources). Resources:
- Can only exist in **one location at a time**
- **Cannot be copied** — the type system enforces this
- **Must be explicitly moved** using the `<-` operator
- **Must be used exactly once** — you cannot ignore or discard them
- Must be created with the `create` keyword
- Must be explicitly moved or destroyed before scope closure

```cadence
// Creating a resource
let vault: @ExampleToken.Vault <- create ExampleToken.Vault(balance: 100.0)

// Moving a resource
let otherVault <- vault  // vault is now invalid

// Destroying a resource (Cadence 1.0: use Burner.burn() for FT vaults)
destroy someResource
```

### 2. The Move Operator (`<-`)
**ALWAYS** use `<-` when:
- Initializing variables with resources: `let r <- create Resource()`
- Assigning resources to variables: `self.vault <- newVault`
- Passing resources to functions: `deposit(from: <- withdrawal)`
- Returning resources from functions: `return <- create Vault(balance: 0.0)`

**Swap Operator** (`<->`) — exchanges resources between two locations:
```cadence
var a <- create R()
var b <- create R()
a <-> b  // swaps ownership
```

### 3. Resource Type Annotations Use `@` Prefix
```cadence
// CORRECT
let vault: @ExampleToken.Vault
fun deposit(from: @{FungibleToken.Vault})
fun withdraw(amount: UFix64): @{FungibleToken.Vault}

// WRONG — missing @
let vault: ExampleToken.Vault
fun deposit(from: {FungibleToken.Vault})
```

### 4. No `msg.sender` — Capability-Based Security
Cadence does NOT have `msg.sender`. Authentication uses **capabilities** and **entitlements**:

```cadence
// WRONG (Solidity thinking)
require(msg.sender == owner)

// CORRECT (Cadence capability-based)
transaction {
    prepare(signer: auth(Storage) &Account) {
        // signer IS the authenticated account
        let vault <- signer.storage.load<@Vault>(from: /storage/vault)!
    }
}
```

### 5. Access Control — Default Restrictive
```cadence
access(self)      // Only this declaration (PREFER THIS)
access(contract)  // Only within this contract
access(account)   // Only within this account
access(all)       // Public (USE SPARINGLY)
```

**Rule**: Start with `access(self)` for everything. Only widen access when external code specifically requires it.

**Critical**: Fields containing resources, structs, or capabilities MUST be `access(self)`:
```cadence
// DANGEROUS
access(all) var adminResource: @AdminResource

// SAFE
access(self) var adminResource: @AdminResource
```

### 6. Entitlements (Cadence 1.0 Access Control)
Entitlements provide fine-grained permission control for references and capabilities:

```cadence
// Declaring an entitlement
access(all) entitlement Withdraw

// Using entitlements to gate functions
access(FungibleToken.Withdraw) fun withdraw(amount: UFix64): @{FungibleToken.Vault} {
    // Only callable with an authorized reference
}

// Account entitlements in transactions
prepare(signer: auth(Storage, Capabilities) &Account) {
    // Can access storage and capabilities
}
```

### 7. View Functions (Cadence 1.0)
The `view` keyword marks read-only functions. View functions:
- Cannot write to, modify, or destroy resources
- Cannot write to or modify references
- Cannot modify variables beyond local scope
- Cannot call non-view functions

```cadence
access(all) view fun getBalance(): UFix64 {
    return self.balance
}

access(all) view fun isCollateralSufficient(amount: UFix64): Bool {
    return self.collateralValue >= amount * self.collateralRatio
}
```

**Pre/post-conditions are now view contexts** — they can only call view functions.

### 8. Capabilities (Cadence 1.0)
Capabilities are references that allow controlled access to stored resources.

```cadence
// Issue a capability from storage
let cap = self.account.capabilities.storage.issue<&ExampleToken.Vault>(storagePath)

// Publish to public path
self.account.capabilities.publish(cap, at: /public/exampleTokenVault)

// Borrow a reference via capability
let vaultRef = getAccount(address)
    .capabilities.get<&{FungibleToken.Receiver}>(/public/exampleTokenReceiver)
    .borrow()
    ?? panic("Could not borrow receiver reference")
```

**IMPORTANT (Cadence 1.0 breaking change)**: `capabilities.get<T>()` no longer returns optional. Instead, invalid capabilities return an object with ID `0` that fails `check()` and `borrow()`. Always validate:
```cadence
let cap = getAccount(addr).capabilities.get<&{FungibleToken.Receiver}>(path)
if !cap.check() {
    panic("Invalid capability")
}
let ref = cap.borrow()!
```

### 9. Accounts Hold Assets (Not Contracts)
Unlike Ethereum where balances are tracked in contract mappings, Flow stores assets directly in user accounts:

```cadence
// Solidity: mapping(address => uint256) balances;
// Cadence: Each user stores their own Vault resource

// Saving to account storage
signer.storage.save(<-vault, to: /storage/myVault)

// Loading from account storage
let vault <- signer.storage.load<@Vault>(from: /storage/myVault)!

// Borrowing a reference (preferred for mutations)
let vaultRef = signer.storage.borrow<&Vault>(from: /storage/myVault)
    ?? panic("No vault found")
```

### 10. Transactions Have Four Phases
```cadence
transaction(arg1: Type1, arg2: Type2) {
    // Phase 1: Declare transaction-scoped variables
    let withdrawnVault: @{FungibleToken.Vault}

    // Phase 2: Access signer accounts (ONLY place to access accounts)
    prepare(signer: auth(Storage) &Account) {
        self.withdrawnVault <- signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(
            from: /storage/flowTokenVault
        )!.withdraw(amount: arg2)
    }

    // Phase 3: Pre-conditions (optional, view context only)
    pre {
        arg2 > 0.0: "Amount must be positive"
    }

    // Phase 4: Execute main logic
    execute {
        let recipient = getAccount(arg1)
        let receiverRef = recipient.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            .borrow() ?? panic("Could not borrow receiver")
        receiverRef.deposit(from: <- self.withdrawnVault)
    }

    // Phase 5: Post-conditions (optional, verify results)
    post {
        // Verify success
    }
}
```

**Best practice**: Only access signer storage in `prepare`. Do all external interactions in `execute`.

---

## FUNGIBLE TOKEN V2 STANDARD

The standard interface all fungible tokens on Flow must implement:

### Core Interfaces
```cadence
access(all) contract interface FungibleToken: ViewResolver {

    // Entitlement controlling withdrawal
    access(all) entitlement Withdraw

    // Events (emitted automatically by interface default implementations)
    access(all) event Withdrawn(type: String, amount: UFix64, from: Address?, fromUUID: UInt64, withdrawnUUID: UInt64, balanceAfter: UFix64)
    access(all) event Deposited(type: String, amount: UFix64, to: Address?, toUUID: UInt64, depositedUUID: UInt64, balanceAfter: UFix64)
    access(all) event Burned(type: String, amount: UFix64, fromUUID: UInt64)

    // Balance interface
    access(all) resource interface Balance {
        access(all) var balance: UFix64
    }

    // Provider interface — withdrawal capability
    access(all) resource interface Provider {
        access(all) view fun isAvailableToWithdraw(amount: UFix64): Bool
        access(Withdraw) fun withdraw(amount: UFix64): @{Vault}
    }

    // Receiver interface — deposit capability
    access(all) resource interface Receiver {
        access(all) fun deposit(from: @{Vault})
        access(all) view fun getSupportedVaultTypes(): {Type: Bool}
        access(all) view fun isSupportedVaultType(type: Type): Bool
    }

    // Vault — combines all interfaces
    access(all) resource interface Vault: Receiver, Provider, Balance {
        access(all) var balance: UFix64
        access(contract) fun burnCallback()
        access(all) fun createEmptyVault(): @{Vault}
    }

    // Contract-level vault creation
    access(all) fun createEmptyVault(vaultType: Type): @{FungibleToken.Vault}
}
```

### Example Token Implementation Pattern
```cadence
import "FungibleToken"
import "MetadataViews"
import "FungibleTokenMetadataViews"

access(all) contract ExampleToken: FungibleToken {
    access(all) var totalSupply: UFix64

    access(all) let VaultStoragePath: StoragePath
    access(all) let VaultPublicPath: PublicPath
    access(all) let ReceiverPublicPath: PublicPath
    access(all) let AdminStoragePath: StoragePath

    access(all) resource Vault: FungibleToken.Vault {
        access(all) var balance: UFix64

        init(balance: UFix64) {
            self.balance = balance
        }

        access(contract) fun burnCallback() {
            if self.balance > 0.0 {
                ExampleToken.totalSupply = ExampleToken.totalSupply - self.balance
            }
            self.balance = 0.0
        }

        access(all) view fun isAvailableToWithdraw(amount: UFix64): Bool {
            return amount <= self.balance
        }

        access(FungibleToken.Withdraw) fun withdraw(amount: UFix64): @ExampleToken.Vault {
            self.balance = self.balance - amount
            return <-create Vault(balance: amount)
        }

        access(all) fun deposit(from: @{FungibleToken.Vault}) {
            let vault <- from as! @ExampleToken.Vault
            self.balance = self.balance + vault.balance
            destroy vault
        }

        access(all) fun createEmptyVault(): @ExampleToken.Vault {
            return <-create Vault(balance: 0.0)
        }
    }

    access(all) resource Minter {
        access(all) fun mintTokens(amount: UFix64): @ExampleToken.Vault {
            ExampleToken.totalSupply = ExampleToken.totalSupply + amount
            return <-create Vault(balance: amount)
        }
    }

    access(all) fun createEmptyVault(vaultType: Type): @ExampleToken.Vault {
        return <-create Vault(balance: 0.0)
    }

    init() {
        self.totalSupply = 0.0
        self.VaultStoragePath = /storage/exampleTokenVault
        self.VaultPublicPath = /public/exampleTokenVault
        self.ReceiverPublicPath = /public/exampleTokenReceiver
        self.AdminStoragePath = /storage/exampleTokenAdmin

        let admin <- create Minter()
        let vault <- admin.mintTokens(amount: 1000.0)
        self.account.storage.save(<-vault, to: self.VaultStoragePath)
        self.account.storage.save(<-admin, to: self.AdminStoragePath)

        let exampleTokenCap = self.account.capabilities.storage.issue<&ExampleToken.Vault>(self.VaultStoragePath)
        self.account.capabilities.publish(exampleTokenCap, at: self.VaultPublicPath)
        let receiverCap = self.account.capabilities.storage.issue<&ExampleToken.Vault>(self.VaultStoragePath)
        self.account.capabilities.publish(receiverCap, at: self.ReceiverPublicPath)
    }
}
```

---

## NON-FUNGIBLE TOKEN V2 STANDARD

### Core Interfaces
```cadence
access(all) contract interface NonFungibleToken: ViewResolver {

    access(all) entitlement Withdraw
    access(all) entitlement Update

    access(all) event Updated(type: String, id: UInt64, uuid: UInt64, owner: Address?)
    access(all) event Withdrawn(type: String, id: UInt64, uuid: UInt64, from: Address?, providerUUID: UInt64)
    access(all) event Deposited(type: String, id: UInt64, uuid: UInt64, to: Address?, collectionUUID: UInt64)

    // NFT resource interface
    access(all) resource interface NFT {
        access(all) let id: UInt64
        access(all) fun createEmptyCollection(): @{Collection}
    }

    // Provider — withdraw NFTs
    access(all) resource interface Provider {
        access(Withdraw) fun withdraw(withdrawID: UInt64): @{NFT}
    }

    // Receiver — deposit NFTs
    access(all) resource interface Receiver {
        access(all) fun deposit(token: @{NFT})
        access(all) view fun getSupportedNFTTypes(): {Type: Bool}
        access(all) view fun isSupportedNFTType(type: Type): Bool
    }

    // Collection — manages owned NFTs
    access(all) resource interface Collection: Provider, Receiver {
        access(all) var ownedNFTs: @{UInt64: {NFT}}
        access(all) view fun getIDs(): [UInt64]
        access(all) view fun getLength(): Int
        access(all) view fun borrowNFT(_ id: UInt64): &{NFT}?
    }
}
```

---

## FLOWTOKEN CONTRACT PATTERN

The native FLOW token follows the FungibleToken V2 standard. Key pattern for interacting with FLOW:

```cadence
// Standard FLOW paths
/storage/flowTokenVault     // Where the vault lives
/public/flowTokenReceiver   // Public receiver capability
/public/flowTokenBalance    // Public balance capability

// Borrowing FLOW vault in a transaction
prepare(signer: auth(Storage) &Account) {
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
        from: /storage/flowTokenVault
    ) ?? panic("Could not borrow FLOW vault")
}
```

---

## DESIGN PATTERNS TO FOLLOW

### 1. Named Value Fields for Constants
Define storage paths and other constants as contract-level fields:
```cadence
access(all) contract MomentsMoney {
    access(all) let LoanStoragePath: StoragePath
    access(all) let CollateralStoragePath: StoragePath
    access(all) let LoanPublicPath: PublicPath

    init() {
        self.LoanStoragePath = /storage/momentsMoneyLoan
        self.CollateralStoragePath = /storage/momentsMoneyCollateral
        self.LoanPublicPath = /public/momentsMoneyLoan
    }
}
```

### 2. Init Singleton for Admin Resources
Create admin resources ONCE in the contract initializer:
```cadence
access(all) contract MomentsMoney {
    init() {
        let admin <- create Admin()
        self.account.storage.save(<-admin, to: /storage/momentsMoneyAdmin)
    }
}
```

### 3. In-Place Mutations via `borrow()` Over Load/Save
```cadence
// PREFERRED — borrow and mutate in-place
let vaultRef = signer.storage.borrow<&Vault>(from: /storage/vault)
    ?? panic("No vault")
vaultRef.deposit(from: <- tokens)

// AVOID — load, modify, save (more expensive)
let vault <- signer.storage.load<@Vault>(from: /storage/vault)!
vault.deposit(from: <- tokens)
signer.storage.save(<-vault, to: /storage/vault)
```

### 4. Script-Accessible Reports via Structs
When scripts need data from resources, return a struct:
```cadence
access(all) struct LoanInfo {
    access(all) let borrower: Address
    access(all) let principal: UFix64
    access(all) let collateralValue: UFix64
    access(all) let interestRate: UFix64
    access(all) let dueDate: UFix64

    init(borrower: Address, principal: UFix64, collateralValue: UFix64, interestRate: UFix64, dueDate: UFix64) {
        self.borrower = borrower
        self.principal = principal
        self.collateralValue = collateralValue
        self.interestRate = interestRate
        self.dueDate = dueDate
    }
}

access(all) view fun getLoanInfo(loanID: UInt64): LoanInfo? {
    // Return struct, not resource
}
```

### 5. Transaction Post-Conditions for Critical Operations
```cadence
transaction(loanID: UInt64, amount: UFix64) {
    prepare(signer: auth(Storage) &Account) { ... }

    post {
        // Verify the repayment was processed correctly
        result.remainingBalance < before(result.remainingBalance):
            "Repayment must reduce remaining balance"
    }
}
```

---

## ANTI-PATTERNS TO AVOID

### 1. NEVER Pass Full Account References
```cadence
// DANGEROUS — gives contract full account access
transaction {
    prepare(signer: auth(Storage) &Account) {
        someContract.doSomething(account: signer)  // NO!
    }
}

// SAFE — pass only the specific capability needed
transaction {
    prepare(signer: auth(Storage) &Account) {
        let cap = signer.capabilities.get<&{FungibleToken.Receiver}>(path)
        someContract.doSomething(receiver: cap)
    }
}
```

### 2. NEVER Make Admin Creation Public
```cadence
// DANGEROUS
access(all) fun createAdmin(): @Admin { return <- create Admin() }

// SAFE — create once in init, deliver to specific address
init() { self.account.storage.save(<-create Admin(), to: /storage/admin) }
```

### 3. NEVER Modify Contract State in Struct Initializers
Structs can be created by anyone without authorization:
```cadence
// DANGEROUS — anyone can increment nextID
access(all) struct Loan {
    init() {
        MomentsMoney.nextLoanID = MomentsMoney.nextLoanID + 1  // NO!
    }
}

// SAFE — use resource functions for state changes
access(all) resource LoanManager {
    access(all) fun createLoan(): @Loan {
        MomentsMoney.nextLoanID = MomentsMoney.nextLoanID + 1
        return <- create Loan(id: MomentsMoney.nextLoanID)
    }
}
```

### 4. NEVER Expose Capabilities as Public Fields
```cadence
// DANGEROUS — anyone can copy the capability
access(all) var myCapability: Capability<&Vault>

// SAFE — publish to account's public section
self.account.capabilities.publish(cap, at: /public/myVault)
```

### 5. NEVER Trust User Storage Blindly
```cadence
// DANGEROUS — user may have stored unexpected type
let vault = signer.storage.load<@AnyResource>(from: path)

// SAFE — always specify expected type
let vault <- signer.storage.load<@ExampleToken.Vault>(from: path)
    ?? panic("Expected ExampleToken.Vault at path")
```

---

## SECURITY BEST PRACTICES FOR DEFI

### Access Control Checklist
- [ ] All resource fields are `access(self)` or `access(contract)`
- [ ] Admin resources created once in `init()` (singleton pattern)
- [ ] Capabilities published with minimum necessary permissions
- [ ] Entitlements used for fine-grained function access
- [ ] No `access(all)` on functions that modify state (unless intended)

### Capability Management Checklist
- [ ] Check existing capabilities via `getControllers()` before creating new ones
- [ ] Always `check()` capabilities before `borrow()`
- [ ] Implement revocation mechanisms for capabilities
- [ ] Minimize published capabilities

### Transaction Safety Checklist
- [ ] Pre-conditions validate all inputs
- [ ] Post-conditions verify state changes
- [ ] Only access accounts in `prepare` phase
- [ ] All external interactions in `execute` phase
- [ ] Never pass `auth(Storage) &Account` to external contracts

### DeFi-Specific Checklist
- [ ] Interest calculations use `view` functions only
- [ ] Collateral ratio checks in pre-conditions
- [ ] Liquidation events emitted for off-chain indexing
- [ ] All token operations follow FungibleToken V2 standard
- [ ] NFT collateral follows NonFungibleToken V2 standard

---

## DEFI LENDING PROTOCOL PATTERNS

### Collateral Vault Pattern
```cadence
access(all) resource CollateralVault {
    access(self) var nfts: @{UInt64: {NonFungibleToken.NFT}}
    access(self) var fungibleCollateral: @{FungibleToken.Vault}

    access(all) view fun getNFTIDs(): [UInt64] {
        return self.nfts.keys
    }

    access(all) view fun getFungibleBalance(): UFix64 {
        return self.fungibleCollateral.balance
    }

    access(contract) fun depositNFT(token: @{NonFungibleToken.NFT}) {
        let id = token.id
        self.nfts[id] <-! token
    }

    access(contract) fun withdrawNFT(id: UInt64): @{NonFungibleToken.NFT} {
        return <- self.nfts.remove(key: id)
            ?? panic("NFT not found in collateral")
    }

    init() {
        self.nfts <- {}
        self.fungibleCollateral <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
    }
}
```

### Loan Resource Pattern
```cadence
access(all) resource Loan {
    access(all) let id: UInt64
    access(all) let borrower: Address
    access(all) var principal: UFix64
    access(all) var interestRate: UFix64
    access(all) let startTime: UFix64
    access(all) var repaidAmount: UFix64
    access(all) var isActive: Bool

    access(all) view fun getOutstandingBalance(): UFix64 {
        let elapsed = getCurrentBlock().timestamp - self.startTime
        let interest = self.principal * self.interestRate * elapsed / (365.0 * 24.0 * 3600.0)
        return self.principal + interest - self.repaidAmount
    }

    access(contract) fun recordRepayment(amount: UFix64) {
        self.repaidAmount = self.repaidAmount + amount
    }

    access(contract) fun close() {
        pre {
            self.getOutstandingBalance() <= 0.0: "Loan not fully repaid"
        }
        self.isActive = false
    }

    init(id: UInt64, borrower: Address, principal: UFix64, interestRate: UFix64) {
        self.id = id
        self.borrower = borrower
        self.principal = principal
        self.interestRate = interestRate
        self.startTime = getCurrentBlock().timestamp
        self.repaidAmount = 0.0
        self.isActive = true
    }
}
```

### Event Pattern for DeFi
```cadence
access(all) event LoanCreated(
    loanID: UInt64,
    borrower: Address,
    principal: UFix64,
    collateralType: String,
    collateralIDs: [UInt64],
    interestRate: UFix64
)

access(all) event LoanRepaid(
    loanID: UInt64,
    borrower: Address,
    amount: UFix64,
    remainingBalance: UFix64
)

access(all) event LoanLiquidated(
    loanID: UInt64,
    borrower: Address,
    liquidator: Address,
    collateralSeized: [UInt64],
    outstandingDebt: UFix64
)

access(all) event CollateralDeposited(
    loanID: UInt64,
    nftType: String,
    nftID: UInt64
)
```

---

## SCRIPTS vs TRANSACTIONS

### Scripts (Read-Only Queries)
```cadence
// Script to check loan health
access(all) fun main(loanID: UInt64, protocolAddress: Address): LoanInfo? {
    let account = getAccount(protocolAddress)
    let managerRef = account.capabilities.get<&LoanManager>(
        /public/momentsMoneyManager
    ).borrow() ?? panic("Could not borrow manager")

    return managerRef.getLoanInfo(loanID: loanID)
}
```

### Transactions (State Changes)
```cadence
// Transaction to create a loan
import "MomentsMoney"
import "NonFungibleToken"

transaction(nftIDs: [UInt64], borrowAmount: UFix64) {
    let collateralNFTs: @[{NonFungibleToken.NFT}]

    prepare(signer: auth(Storage) &Account) {
        self.collateralNFTs <- []
        let collection = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
            from: /storage/momentCollection
        ) ?? panic("No collection found")

        for id in nftIDs {
            self.collateralNFTs.append(<- collection.withdraw(withdrawID: id))
        }
    }

    execute {
        MomentsMoney.createLoan(
            collateral: <- self.collateralNFTs,
            borrowAmount: borrowAmount
        )
    }
}
```

---

## CADENCE SYNTAX QUICK REFERENCE

### Types
| Type | Description |
|------|-------------|
| `Bool` | true/false |
| `Int`, `Int8`...`Int256` | Signed integers |
| `UInt`, `UInt8`...`UInt256` | Unsigned integers |
| `UFix64` | Fixed-point decimal (used for token amounts) |
| `Fix64` | Signed fixed-point decimal |
| `String` | Text |
| `Address` | Account address |
| `[Type]` | Array |
| `{KeyType: ValueType}` | Dictionary |
| `@Resource` | Resource type |
| `&Type` | Reference type |
| `Type?` | Optional |
| `StoragePath` | `/storage/...` path type |
| `PublicPath` | `/public/...` path type |

### Control Flow
```cadence
// If-else
if condition {
    // ...
} else if otherCondition {
    // ...
} else {
    // ...
}

// Optional binding
if let value = optionalValue {
    // value is unwrapped
}

// Force unwrap (panics if nil)
let value = optionalValue!

// Nil coalescing
let value = optionalValue ?? defaultValue

// For-in loops
for item in array { }
for key in dictionary.keys { }

// While loops
while condition { }
```

### Enumerations
```cadence
access(all) enum LoanStatus: UInt8 {
    access(all) case Active
    access(all) case Repaid
    access(all) case Liquidated
    access(all) case Defaulted
}
```

### Interface Declaration
```cadence
access(all) resource interface LoanProvider {
    access(all) view fun getAvailableLiquidity(): UFix64
    access(all) fun provideLoan(amount: UFix64): @{FungibleToken.Vault}
}
```

### Intersection Types
```cadence
// Any value implementing FungibleToken.Vault interface
@{FungibleToken.Vault}

// Reference to anything implementing Receiver
&{FungibleToken.Receiver}
```

---

## IMPORTS (CADENCE 1.0 STYLE)

```cadence
// Cadence 1.0 uses string-based imports
import "FungibleToken"
import "NonFungibleToken"
import "FlowToken"
import "MetadataViews"
import "FungibleTokenMetadataViews"

// For specific contract addresses (testnet/mainnet deployment)
import FungibleToken from 0xf233dcee88fe0abe  // Mainnet
import NonFungibleToken from 0x1d7e57aa55817448  // Mainnet
```

---

## COMMON ERRORS TO WATCH FOR

1. **Missing `<-` on resource assignment** — The compiler will reject `=` for resources
2. **Forgetting `@` in resource type annotations** — All resource types need `@` prefix
3. **Using `as!` in reference expressions** — Only `as` is valid in Cadence 1.0
4. **Nil-checking capabilities instead of using `check()`** — Cadence 1.0 capabilities are non-optional
5. **Missing argument labels in function calls** — Cadence 1.0 enforces label matching
6. **Calling non-view functions in pre/post conditions** — Conditions are view contexts in 1.0
7. **Access modifier mismatch with interface** — Implementation must exactly match interface access levels
8. **Modifying state in struct initializers** — Structs are freely instantiable; use resources for state changes
9. **Forgetting to destroy resources** — All code paths must explicitly handle resources
10. **Using `load`/`save` instead of `borrow`** — Prefer in-place mutations for efficiency

---

## TESTING

Use the Cadence testing framework:
```cadence
import Test

access(all) fun testCreateLoan() {
    let account = Test.createAccount()
    // Setup test environment
    // Deploy contracts
    // Execute transactions
    // Assert results
}
```

---

## KEY ADDRESSES (FLOW MAINNET)

| Contract | Address |
|----------|---------|
| FungibleToken | 0xf233dcee88fe0abe |
| NonFungibleToken | 0x1d7e57aa55817448 |
| FlowToken | 0x1654653399040a61 |
| MetadataViews | 0x1d7e57aa55817448 |

---

**End of CLAUDE.md reference. Always consult this file before generating Cadence code.**
