// get_outstanding_balance.cdc
// Returns current outstanding balance (principal + fixed interest - repaid) for a loan.
// Returns 0.0 if the loan does not exist or is already fully repaid.

import "MomentsMoney"

access(all) fun main(contractAddress: Address, loanID: UInt64): UFix64 {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getOutstandingBalance(loanID: loanID)
}
