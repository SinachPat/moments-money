"use client";

import { useQuery } from "@tanstack/react-query";
import { executeScript } from "@/lib/fcl";
import { useAuth } from "@/context/AuthContext";

interface NFTItem {
  id: string;
  thumbnail?: string;
  name?: string;
}

// Extracts the path identifier from a storage path string.
// "/storage/MomentCollection" → "MomentCollection"
// FCL t.Path requires { domain, identifier } — not a raw path string.
function storageToPublicIdentifier(storagePath: string): string {
  return storagePath.replace(/^\/storage\//, "");
}

// Cadence script that reads NFT IDs and attempts to resolve MetadataViews.Display
// for name and thumbnail. Returns an array of {String: String?} dictionaries.
const GET_USER_NFTS = `
import "NonFungibleToken"
import "MetadataViews"

access(all) fun main(address: Address, collectionPublicPath: PublicPath): [{String: String}] {
    let account = getAccount(address)
    let collection = account
        .capabilities.get<&{NonFungibleToken.Collection}>(collectionPublicPath)
        .borrow()

    if collection == nil {
        return []
    }

    let ids = collection!.getIDs()
    var result: [{String: String}] = []

    for id in ids {
        var item: {String: String} = {"id": id.toString()}

        if let nft = collection!.borrowNFT(id) {
            if let display = nft.resolveView(Type<MetadataViews.Display>()) as? MetadataViews.Display {
                item["name"] = display.name
                if let httpFile = display.thumbnail as? MetadataViews.HTTPFile {
                    item["thumbnail"] = httpFile.url
                } else if let ipfsFile = display.thumbnail as? MetadataViews.IPFSFile {
                    item["thumbnail"] = "https://ipfs.io/ipfs/".concat(ipfsFile.cid)
                }
            }
        }

        result.append(item)
    }

    return result
}`;

export function useNFTs(collectionStoragePath: string, collectionIdentifier: string) {
  const { address, isLoggedIn } = useAuth();
  // Scripts access public capabilities — extract identifier, then build FCL Path object
  const publicIdentifier = storageToPublicIdentifier(collectionStoragePath);

  const { data, isLoading, refetch } = useQuery<NFTItem[]>({
    queryKey: ["nfts", address, collectionIdentifier],
    queryFn: async () => {
      const raw = await executeScript<Array<Record<string, string>>>(
        GET_USER_NFTS,
        (arg, t) => [
          arg(address!, t.Address),
          arg({ domain: "public", identifier: publicIdentifier }, t.Path),
        ],
      );
      return raw.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.thumbnail,
      }));
    },
    staleTime: 30 * 1000,
    enabled: isLoggedIn && !!address && !!collectionStoragePath,
  });

  return { nfts: data ?? [], isLoading, refetch };
}
