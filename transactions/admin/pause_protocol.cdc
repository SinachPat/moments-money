// pause_protocol.cdc
// Admin halts new loan creation. Existing active loans are unaffected
// and can still be repaid or liquidated.
// Use in emergencies or when the treasury needs to be replenished.

import "MomentsMoney"

transaction {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")
    }

    execute {
        self.adminRef.pauseProtocol()
    }
}
