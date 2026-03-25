// get_max_borrow_amount.cdc
// Returns maximum FLOW borrowable for N NFTs from a given collection.
// Returns 0.0 if the collection is not whitelisted or not active.

import "MomentsMoney"

access(all) fun main(contractAddress: Address, collectionIdentifier: String, nftCount: UInt64): UFix64 {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getMaxBorrowAmount(identifier: collectionIdentifier, nftCount: nftCount)
}
