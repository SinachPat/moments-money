// withdraw_treasury.cdc
// Admin withdraws FLOW from the protocol treasury to the admin's wallet.
// Use to claim protocol earnings (interest collected) or rebalance capital.
// Will fail if withdrawal would reduce treasury below zero.

import "MomentsMoney"
import "FungibleToken"

transaction(amount: UFix64) {
    let adminRef: &MomentsMoney.Admin
    let managerRef: &MomentsMoney.LoanManager
    let receiverRef: &{FungibleToken.Receiver}

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")

        self.managerRef = signer.storage.borrow<&MomentsMoney.LoanManager>(
            from: MomentsMoney.LoanManagerStoragePath
        ) ?? panic("Could not borrow LoanManager from storage")

        self.receiverRef = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            .borrow() ?? panic("Could not borrow FLOW receiver capability")
    }

    execute {
        let withdrawn <- self.managerRef.withdrawFromTreasury(adminRef: self.adminRef, amount: amount)
        self.receiverRef.deposit(from: <- withdrawn)
    }
}
