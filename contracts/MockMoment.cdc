// MockMoment.cdc
// Testnet-only mock NFT for end-to-end testing of the Moments Money protocol.
// Exposes a public Minter capability so anyone can claim test NFTs without
// needing access to the deployer account.

import "NonFungibleToken"
import "MetadataViews"

access(all) contract MockMoment: NonFungibleToken {

    access(all) var totalSupply: UInt64

    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath:  PublicPath
    access(all) let MinterStoragePath:     StoragePath
    access(all) let MinterPublicPath:      PublicPath

    // ─── CONTRACT-LEVEL VIEWS (required by ViewResolver / NonFungibleToken) ───

    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [
            Type<MetadataViews.NFTCollectionData>(),
            Type<MetadataViews.NFTCollectionDisplay>()
        ]
    }

    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                return MetadataViews.NFTCollectionData(
                    storagePath: MockMoment.CollectionStoragePath,
                    publicPath:  MockMoment.CollectionPublicPath,
                    publicCollection: Type<&MockMoment.Collection>(),
                    publicLinkedType: Type<&MockMoment.Collection>(),
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                return MetadataViews.NFTCollectionDisplay(
                    name: "Mock Moment",
                    description: "Test Moments for the Moments Money testnet protocol.",
                    externalURL: MetadataViews.ExternalURL("https://momentsmoney.app"),
                    squareImage: MetadataViews.Media(
                        file: MetadataViews.HTTPFile(
                            url: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mockmomentsquare&backgroundColor=b6e3f4"
                        ),
                        mediaType: "image/svg+xml"
                    ),
                    bannerImage: MetadataViews.Media(
                        file: MetadataViews.HTTPFile(
                            url: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mockmomentbanner&backgroundColor=b6e3f4"
                        ),
                        mediaType: "image/svg+xml"
                    ),
                    socials: {}
                )
        }
        return nil
    }

    // ─── NFT ──────────────────────────────────────────────────────────────────

    access(all) resource NFT: NonFungibleToken.NFT {
        access(all) let id: UInt64

        access(all) view fun getViews(): [Type] {
            return [Type<MetadataViews.Display>()]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    // Each NFT gets a unique pixel-art character seeded by its ID.
                    // DiceBear generates deterministic, colorful NFT-style art per seed.
                    let seed = "mockmoment".concat(self.id.toString())
                    let imageURL = "https://api.dicebear.com/9.x/pixel-art/svg?seed="
                        .concat(seed)
                        .concat("&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf")
                    return MetadataViews.Display(
                        name: "Mock Moment #".concat(self.id.toString()),
                        description: "A testnet Mock Moment for the Moments Money protocol.",
                        thumbnail: MetadataViews.HTTPFile(url: imageURL)
                    )
            }
            return nil
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>())
        }

        init(id: UInt64) {
            self.id = id
        }
    }

    // ─── COLLECTION ───────────────────────────────────────────────────────────

    access(all) resource Collection: NonFungibleToken.Collection {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        access(all) view fun getIDs(): [UInt64]  { return self.ownedNFTs.keys }
        access(all) view fun getLength(): Int     { return self.ownedNFTs.length }

        access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
            return {Type<@MockMoment.NFT>(): true}
        }

        access(all) view fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@MockMoment.NFT>()
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @MockMoment.NFT
            self.ownedNFTs[nft.id] <-! nft
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            pre {
                self.ownedNFTs[withdrawID] != nil:
                    "MockMoment not found: ".concat(withdrawID.toString())
            }
            return <- self.ownedNFTs.remove(key: withdrawID)!
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id]
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- MockMoment.createEmptyCollection(nftType: Type<@MockMoment.NFT>())
        }

        init() { self.ownedNFTs <- {} }
    }

    // ─── MINTER ───────────────────────────────────────────────────────────────

    // Public interface — anyone can call mintNFT() to receive a test token.
    // Intentionally open on testnet; do not use this pattern on mainnet.
    access(all) resource interface MinterPublic {
        access(all) fun mintNFT(): @MockMoment.NFT
    }

    access(all) resource Minter: MinterPublic {
        access(all) fun mintNFT(): @MockMoment.NFT {
            MockMoment.totalSupply = MockMoment.totalSupply + 1
            return <- create NFT(id: MockMoment.totalSupply)
        }
    }

    // ─── CONTRACT-LEVEL ───────────────────────────────────────────────────────

    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }

    init() {
        self.totalSupply = 0

        self.CollectionStoragePath = /storage/MockMomentCollection
        self.CollectionPublicPath  = /public/MockMomentCollection
        self.MinterStoragePath     = /storage/MockMomentMinter
        self.MinterPublicPath      = /public/MockMomentMinter

        // Publish the public minter so anyone can claim test NFTs
        self.account.storage.save(<- create Minter(), to: self.MinterStoragePath)
        let minterCap = self.account.capabilities.storage.issue<&{MinterPublic}>(
            self.MinterStoragePath
        )
        self.account.capabilities.publish(minterCap, at: self.MinterPublicPath)

        // Set up the deployer's own collection
        self.account.storage.save(<- create Collection(), to: self.CollectionStoragePath)
        let collectionCap = self.account.capabilities.storage.issue<&Collection>(
            self.CollectionStoragePath
        )
        self.account.capabilities.publish(collectionCap, at: self.CollectionPublicPath)
    }
}
