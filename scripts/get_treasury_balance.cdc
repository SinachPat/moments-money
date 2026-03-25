// get_treasury_balance.cdc
// Returns the current FLOW balance in the protocol treasury vault.

import "MomentsMoney"

access(all) fun main(contractAddress: Address): UFix64 {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getTreasuryBalance()
}
