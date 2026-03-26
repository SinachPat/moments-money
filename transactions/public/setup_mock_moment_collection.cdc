// setup_mock_moment_collection.cdc
// Test-only helper: sets up a MockMoment collection for the signer and mints
// a specified number of NFTs using the deployer's public Minter capability.
// Parameters:
//   deployerAddress — account where MockMoment is deployed (holds the Minter)
//   mintCount       — number of NFTs to mint into the signer's collection

import "MockMoment"
import "NonFungibleToken"

transaction(deployerAddress: Address, mintCount: Int) {

    prepare(signer: auth(Storage, Capabilities) &Account) {

        // ── 1. Set up collection if missing ──────────────────────────────────
        if signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) == nil {
            signer.storage.save(
                <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>()),
                to: MockMoment.CollectionStoragePath
            )
            let cap = signer.capabilities.storage.issue<&MockMoment.Collection>(
                MockMoment.CollectionStoragePath
            )
            signer.capabilities.publish(cap, at: MockMoment.CollectionPublicPath)
        }

        // ── 2. Borrow the public Minter from the deployer account ─────────────
        let minterCap = getAccount(deployerAddress)
            .capabilities.get<&{MockMoment.MinterPublic}>(MockMoment.MinterPublicPath)
        if !minterCap.check() {
            panic("MockMoment Minter not found at deployerAddress — check MockMoment deployment")
        }
        let minter = minterCap.borrow()!

        // ── 3. Mint requested NFTs into the signer's collection ───────────────
        let collection = signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) ?? panic("Collection not found after setup — this should never happen")

        var i = 0
        while i < mintCount {
            collection.deposit(token: <- minter.mintNFT())
            i = i + 1
        }
    }
}
