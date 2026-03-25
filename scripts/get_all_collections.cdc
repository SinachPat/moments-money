// get_all_collections.cdc
// Returns all whitelisted CollectionConfig structs, including inactive ones.
// The frontend filters by isActive for display purposes.

import "MomentsMoney"

access(all) fun main(contractAddress: Address): [MomentsMoney.CollectionConfig] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")

    return manager.getAllCollections()
}
