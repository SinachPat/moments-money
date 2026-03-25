// add_collection.cdc
// Admin registers a new NFT collection as accepted collateral.
// Must be signed by the account that holds the Admin resource.
//
// Parameters:
//   collectionIdentifier — e.g. "A.0b2a3299cc857e29.TopShot.NFT"
//   displayName          — human-readable name, e.g. "NBA Top Shot"
//   floorPrice           — admin-set FLOW floor price per NFT
//   ltvRatio             — loan-to-value ratio, e.g. 0.40 for 40%
//   interestRate         — annual simple interest rate, e.g. 0.15 for 15% APR
//   maxLoanDuration      — maximum duration in seconds, e.g. 2592000 = 30 days
//   tier                 — 1 (highest LTV), 2, or 3 (lowest LTV)

import "MomentsMoney"

transaction(
    collectionIdentifier: String,
    displayName: String,
    floorPrice: UFix64,
    ltvRatio: UFix64,
    interestRate: UFix64,
    maxLoanDuration: UFix64,
    tier: UInt8
) {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")
    }

    execute {
        self.adminRef.addCollection(
            collectionIdentifier: collectionIdentifier,
            displayName: displayName,
            floorPrice: floorPrice,
            ltvRatio: ltvRatio,
            interestRate: interestRate,
            maxLoanDuration: maxLoanDuration,
            tier: tier
        )
    }
}
