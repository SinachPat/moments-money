// get_loan_info.cdc
// Returns full LoanInfo struct for a given loan ID.
// Returns nil if the loan does not exist.

import "MomentsMoney"

access(all) fun main(contractAddress: Address, loanID: UInt64): MomentsMoney.LoanInfo? {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getLoanInfo(loanID: loanID)
}
