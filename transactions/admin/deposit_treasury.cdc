// deposit_treasury.cdc
// Admin deposits FLOW tokens into the protocol lending treasury.
// The protocol draws from this treasury when disbursing loans.
// Recommended to keep well above the 500 FLOW auto-pause threshold.

import "MomentsMoney"
import "FungibleToken"
import "FlowToken"

transaction(amount: UFix64) {
    let adminRef: &MomentsMoney.Admin
    let managerRef: &MomentsMoney.LoanManager
    let funds: @{FungibleToken.Vault}

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")

        self.managerRef = signer.storage.borrow<&MomentsMoney.LoanManager>(
            from: MomentsMoney.LoanManagerStoragePath
        ) ?? panic("Could not borrow LoanManager from storage")

        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow FLOW vault")

        self.funds <- flowVault.withdraw(amount: amount)
    }

    execute {
        self.managerRef.depositToTreasury(adminRef: self.adminRef, funds: <- self.funds)
    }
}
