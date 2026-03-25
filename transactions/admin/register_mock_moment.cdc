// register_mock_moment.cdc
// Admin-only transaction: add MockMoment as accepted collateral in MomentsMoney.
// Floor price: 10 FLOW, LTV: 70%, interest rate: 5% APR, duration: 30 days, tier: 2

import MomentsMoney from 0x5f48399c13df4365

transaction {
    let admin: &MomentsMoney.Admin

    prepare(signer: auth(Storage) &Account) {
        self.admin = signer.storage.borrow<&MomentsMoney.Admin>(
            from: MomentsMoney.AdminStoragePath
        ) ?? panic("Could not borrow Admin — must be signed by deployer account")
    }

    execute {
        self.admin.addCollection(
            collectionIdentifier: "A.5f48399c13df4365.MockMoment.NFT",
            displayName:          "Mock Moment (Testnet)",
            floorPrice:           10.0,
            ltvRatio:             0.70,
            interestRate:         0.05,
            maxLoanDuration:      2592000.0,   // 30 days in seconds
            tier:                 2
        )
        log("MockMoment registered as accepted collateral")
    }
}
