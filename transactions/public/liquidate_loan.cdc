// liquidate_loan.cdc
// Anyone can trigger forfeiture on an expired loan past the 24-hour grace period.
// The caller receives a fixed 1 FLOW keeper fee from the protocol treasury.
//
// Parameters:
//   loanID          — ID of the expired loan to liquidate
//   protocolAddress — address of the deployed MomentsMoney contract

import "MomentsMoney"
import "FungibleToken"

transaction(loanID: UInt64, protocolAddress: Address) {
    let keeperFlowReceiverCap: Capability<&{FungibleToken.Receiver}>

    prepare(signer: auth(Storage) &Account) {
        // Keeper fee is sent to the caller's FLOW receiver
        self.keeperFlowReceiverCap = signer.capabilities.get<&{FungibleToken.Receiver}>(
            /public/flowTokenReceiver
        )
    }

    pre {
        self.keeperFlowReceiverCap.check(): "No FLOW receiver capability — set up your flowTokenReceiver before calling this"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        // Verify loan exists and is eligible before calling liquidate —
        // produces clear, actionable error messages for the caller
        let info = manager.getLoanInfo(loanID: loanID)
            ?? panic("Loan #".concat(loanID.toString()).concat(" does not exist"))

        if info.status != MomentsMoney.LoanStatus.Active {
            panic("Loan #".concat(loanID.toString()).concat(" is not active — status: ").concat(info.status.rawValue.toString()))
        }

        if !info.isEligibleForLiquidation {
            if !info.isExpired {
                panic("Loan #".concat(loanID.toString()).concat(" has not expired yet — expiry: ").concat(info.expiryTime.toString()))
            }
            panic("Loan #".concat(loanID.toString()).concat(" is within the 24-hour grace period — try again after: ").concat((info.expiryTime + MomentsMoney.GRACE_PERIOD).toString()))
        }

        manager.liquidateLoan(
            loanID: loanID,
            keeperFlowReceiverCap: self.keeperFlowReceiverCap
        )

        log("Loan #".concat(loanID.toString()).concat(" liquidated. Keeper fee of 1 FLOW sent to caller."))
    }
}
