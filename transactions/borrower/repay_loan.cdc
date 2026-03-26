// repay_loan.cdc
// Borrower sends FLOW to repay an active loan.
// Partial payments reduce outstanding balance but do not release collateral.
// Full payment (repaymentAmount == outstanding balance) returns all collateral NFTs
// to the receiver capability that was stored inside the loan at creation time —
// this cannot be overridden by the caller, preventing collateral redirection attacks.
//
// Parameters:
//   loanID          — ID of the loan to repay
//   repaymentAmount — FLOW tokens to send (must be <= outstanding balance)
//   protocolAddress — address of the deployed MomentsMoney contract

import "MomentsMoney"
import "FungibleToken"
import "FlowToken"

transaction(
    loanID: UInt64,
    repaymentAmount: UFix64,
    protocolAddress: Address
) {
    let payment: @{FungibleToken.Vault}

    prepare(signer: auth(Storage) &Account) {
        // Withdraw repayment from the borrower's FLOW vault
        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow FLOW vault — ensure /storage/flowTokenVault exists")

        self.payment <- flowVault.withdraw(amount: repaymentAmount)
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        manager.repayLoan(
            loanID: loanID,
            payment: <- self.payment
        )
    }
}
