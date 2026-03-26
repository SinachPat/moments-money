// get_nft_ids.cdc
// Returns the IDs of all MockMoment NFTs owned by an address.
// Used in tests to set up loan collateral.

import "MockMoment"

access(all) fun main(addr: Address): [UInt64] {
    let cap = getAccount(addr)
        .capabilities.get<&MockMoment.Collection>(MockMoment.CollectionPublicPath)
    if !cap.check() { return [] }
    return cap.borrow()!.getIDs()
}
