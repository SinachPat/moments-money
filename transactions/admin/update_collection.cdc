// update_collection.cdc
// Admin updates parameters for an existing whitelisted collection.
// Pass nil for any parameter you do not want to change.
// Updating floor price affects max borrow amounts for NEW loans only —
// existing loans retain their original terms.

import "MomentsMoney"

transaction(
    collectionIdentifier: String,
    floorPrice: UFix64?,
    ltvRatio: UFix64?,
    interestRate: UFix64?,
    maxLoanDuration: UFix64?,
    isActive: Bool?
) {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")
    }

    execute {
        self.adminRef.updateCollection(
            collectionIdentifier: collectionIdentifier,
            floorPrice: floorPrice,
            ltvRatio: ltvRatio,
            interestRate: interestRate,
            maxLoanDuration: maxLoanDuration,
            isActive: isActive
        )
    }
}
