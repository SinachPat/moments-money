// repay_loan.cdc
// Borrower sends FLOW to repay an active loan.
// Partial payments reduce outstanding balance but do not release collateral.
// Full payment (repaymentAmount == outstanding balance) returns all collateral NFTs.
//
// Parameters:
//   loanID              — ID of the loan to repay
//   repaymentAmount     — FLOW tokens to send (must be <= outstanding balance)
//   nftReceiverPublicPath — public path for borrower's NFT receiver (for full-repayment return)
//   protocolAddress     — address of the deployed MomentsMoney contract

import "MomentsMoney"
import "FungibleToken"
import "NonFungibleToken"
import "FlowToken"

transaction(
    loanID: UInt64,
    repaymentAmount: UFix64,
    nftReceiverPublicPath: PublicPath,
    protocolAddress: Address
) {
    let payment: @{FungibleToken.Vault}
    let nftReceiverCap: Capability<&{NonFungibleToken.Receiver}>

    prepare(signer: auth(Storage) &Account) {
        // Withdraw repayment from the borrower's FLOW vault
        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow FLOW vault — ensure /storage/flowTokenVault exists")

        self.payment <- flowVault.withdraw(amount: repaymentAmount)
        self.nftReceiverCap = signer.capabilities.get<&{NonFungibleToken.Receiver}>(nftReceiverPublicPath)
    }

    pre {
        self.nftReceiverCap.check(): "No NFT receiver capability at the provided path"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        manager.repayLoan(
            loanID: loanID,
            payment: <- self.payment,
            nftReceiverCap: self.nftReceiverCap
        )
    }
}
