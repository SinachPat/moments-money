// withdraw_forfeited_nfts.cdc
// Admin withdraws all NFTs from a liquidated loan's forfeited vault
// into an admin-owned collection.
//
// Parameters:
//   loanID               — ID of the liquidated loan whose collateral to claim
//   nftReceiverPublicPath — public path of the admin's NFT collection receiver
//                          for the relevant collection type

import "MomentsMoney"
import "NonFungibleToken"

transaction(loanID: UInt64, nftReceiverPublicPath: PublicPath) {
    let adminRef: &MomentsMoney.Admin
    let managerRef: &MomentsMoney.LoanManager
    let receiverRef: &{NonFungibleToken.Receiver}

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")

        self.managerRef = signer.storage.borrow<&MomentsMoney.LoanManager>(
            from: MomentsMoney.LoanManagerStoragePath
        ) ?? panic("Could not borrow LoanManager from storage")

        self.receiverRef = signer.capabilities.get<&{NonFungibleToken.Receiver}>(nftReceiverPublicPath)
            .borrow() ?? panic("Could not borrow NFT receiver at provided path")
    }

    execute {
        let nfts <- self.managerRef.withdrawForfeitedVault(adminRef: self.adminRef, loanID: loanID)
        while nfts.length > 0 {
            self.receiverRef.deposit(token: <- nfts.remove(at: 0))
        }
        destroy nfts
    }
}
