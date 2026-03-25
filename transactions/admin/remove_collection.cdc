// remove_collection.cdc
// Admin deactivates a collection — no new loans will be accepted against it.
// The collection record is preserved (history intact, re-activation possible).
// Existing active loans are unaffected and can still be repaid or liquidated.

import "MomentsMoney"

transaction(collectionIdentifier: String) {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")
    }

    execute {
        self.adminRef.deactivateCollection(collectionIdentifier: collectionIdentifier)
    }
}
