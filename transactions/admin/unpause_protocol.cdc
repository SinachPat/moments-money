// unpause_protocol.cdc
// Admin resumes new loan creation after a pause.
// Verify that the treasury has sufficient FLOW before unpausing.

import "MomentsMoney"

transaction {
    let adminRef: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.adminRef = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin resource — transaction must be signed by the protocol deployer")
    }

    execute {
        self.adminRef.unpauseProtocol()
    }
}
