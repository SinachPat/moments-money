// get_all_active_loans.cdc
// Returns all active loans across all borrowers by iterating loan IDs 1..nextLoanID.
// Used by the loan expiry monitor service — there is no per-address filter here.
// NOTE: This script is O(nextLoanID). For large volumes, consider an index in the contract.

import "MomentsMoney"

access(all) fun main(contractAddress: Address): [MomentsMoney.LoanInfo] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    var results: [MomentsMoney.LoanInfo] = []
    var id: UInt64 = 1

    while id < MomentsMoney.nextLoanID {
        if let info = manager.getLoanInfo(loanID: id) {
            if info.status == MomentsMoney.LoanStatus.Active {
                results.append(info)
            }
        }
        id = id + 1
    }

    return results
}
