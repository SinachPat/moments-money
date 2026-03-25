// create_loan.cdc
// Borrower deposits NFT collateral and receives FLOW tokens.
//
// Parameters:
//   nftIDs               — IDs of the NFTs to deposit as collateral
//   collectionIdentifier — protocol whitelist key, e.g. "A.0b2a3299cc857e29.TopShot.NFT"
//   collectionStoragePath — storage path of the borrower's NFT collection
//   nftReceiverPublicPath — public path for the borrower's NFT receiver (used for returns)
//   borrowAmount         — FLOW tokens to borrow (must be <= max for deposited collateral)
//   duration             — loan duration in seconds (e.g. 604800 = 7 days)
//   protocolAddress      — address of the deployed MomentsMoney contract

import "MomentsMoney"
import "NonFungibleToken"
import "FungibleToken"

transaction(
    nftIDs: [UInt64],
    collectionIdentifier: String,
    collectionStoragePath: StoragePath,
    nftReceiverPublicPath: PublicPath,
    borrowAmount: UFix64,
    duration: UFix64,
    protocolAddress: Address
) {
    let nfts: @[{NonFungibleToken.NFT}]
    let flowReceiverCap: Capability<&{FungibleToken.Receiver}>
    let nftReturnReceiverCap: Capability<&{NonFungibleToken.Receiver}>
    let borrower: Address

    prepare(signer: auth(Storage) &Account) {
        // Withdraw the specified NFTs from the borrower's collection
        let collection = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
            from: collectionStoragePath
        ) ?? panic("Could not borrow NFT collection from storage — check collectionStoragePath")

        self.nfts <- []
        for id in nftIDs {
            self.nfts.append(<- collection.withdraw(withdrawID: id))
        }

        // Capture capabilities in prepare (cannot access signer in execute)
        self.flowReceiverCap = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        self.nftReturnReceiverCap = signer.capabilities.get<&{NonFungibleToken.Receiver}>(nftReceiverPublicPath)
        self.borrower = signer.address
    }

    pre {
        self.flowReceiverCap.check(): "No FLOW receiver capability — ensure flowTokenReceiver is published"
        self.nftReturnReceiverCap.check(): "No NFT receiver capability at the provided path"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        manager.createLoan(
            nfts: <- self.nfts,
            collectionIdentifier: collectionIdentifier,
            borrowAmount: borrowAmount,
            duration: duration,
            borrower: self.borrower,
            flowReceiverCap: self.flowReceiverCap,
            nftReturnReceiverCap: self.nftReturnReceiverCap
        )

        // nextLoanID has already been incremented — subtract 1 to get the loan just created
        log("Loan created. Loan ID: ".concat((MomentsMoney.nextLoanID - 1).toString()))
    }
}
