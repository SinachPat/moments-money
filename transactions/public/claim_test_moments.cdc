// claim_test_moments.cdc
// Anyone can sign this transaction to receive 5 Mock Moments for testnet testing.
// Sets up a MockMoment collection in the signer's account (if not already present)
// then mints 5 NFTs directly into it via the public Minter capability.

import NonFungibleToken from 0x631e88ae7f1d7c20
import MockMoment       from 0x5f48399c13df4365

transaction {

    prepare(signer: auth(Storage, Capabilities) &Account) {

        // ── 1. Set up collection if not already present ──────────────────────
        if signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) == nil {
            signer.storage.save(
                <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>()),
                to: MockMoment.CollectionStoragePath
            )
            let collectionCap = signer.capabilities.storage.issue<&MockMoment.Collection>(
                MockMoment.CollectionStoragePath
            )
            signer.capabilities.publish(collectionCap, at: MockMoment.CollectionPublicPath)
        }

        // ── 2. Borrow the public minter from the deployer account ─────────────
        let minterCap = getAccount(0x5f48399c13df4365)
            .capabilities.get<&{MockMoment.MinterPublic}>(MockMoment.MinterPublicPath)
        if !minterCap.check() {
            panic("Could not borrow public Minter capability from deployer")
        }
        let minter = minterCap.borrow()!

        // ── 3. Borrow the signer's collection ────────────────────────────────
        let collection = signer.storage.borrow<&MockMoment.Collection>(
            from: MockMoment.CollectionStoragePath
        ) ?? panic("Collection not found — this should never happen")

        // ── 4. Mint 5 NFTs directly into the collection ───────────────────────
        var i = 0
        while i < 5 {
            let nft <- minter.mintNFT()
            collection.deposit(token: <- nft)
            i = i + 1
        }

        log("Minted 5 Mock Moments into signer's collection")
    }
}
