// get_active_loans_by_address.cdc
// Returns full LoanInfo objects for all active loans belonging to a borrower.
// Returns an empty array if the borrower has no active loans.

import "MomentsMoney"

access(all) fun main(contractAddress: Address, borrower: Address): [MomentsMoney.LoanInfo] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getActiveLoans(borrower: borrower)
}
