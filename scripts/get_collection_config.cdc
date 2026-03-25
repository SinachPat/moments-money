// get_collection_config.cdc
// Returns CollectionConfig for a given collection identifier.
// Returns nil if the collection is not whitelisted.

import "MomentsMoney"

access(all) fun main(contractAddress: Address, collectionIdentifier: String): MomentsMoney.CollectionConfig? {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getCollectionConfig(identifier: collectionIdentifier)
}
