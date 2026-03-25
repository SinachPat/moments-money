// get_protocol_stats.cdc
// Returns aggregate ProtocolStats: totalLoans, activeLoans, totalFlowDisbursed,
// totalInterestEarned, treasuryBalance, isPaused.

import "MomentsMoney"

access(all) fun main(contractAddress: Address): MomentsMoney.ProtocolStats {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getProtocolStats()
}
