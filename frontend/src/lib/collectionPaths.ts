/**
 * Maps collection identifiers to their canonical Flow storage and public paths.
 * Storage paths are needed for NFT withdrawal in transactions.
 * Public paths are needed for scripts (which cannot access storage directly).
 *
 * Add new entries here as collections are whitelisted in the contract.
 */
const KNOWN_PATHS: Record<string, { storage: string; public: string }> = {
  "A.0b2a3299cc857e29.TopShot.NFT": {
    storage: "MomentCollection",
    public: "MomentCollection",
  },
  "A.329feb3ab062d289.UFC_NFT.NFT": {
    storage: "UFC_NFTCollection",
    public: "UFC_NFTCollection",
  },
  "A.e4cf4bdc1751c65d.AllDay.NFT": {
    storage: "AllDayCollection",
    public: "AllDayCollection",
  },
  // Testnet-only mock collection for end-to-end testing
  "A.5f48399c13df4365.MockMoment.NFT": {
    storage: "MockMomentCollection",
    public: "MockMomentCollection",
  },
};

export interface CollectionPaths {
  /** Identifier string for FCL path arg, e.g. "MomentCollection" */
  storage: string;
  /** Identifier string for FCL path arg, e.g. "MomentCollection" */
  public: string;
}

/**
 * Returns the storage and public path identifiers for an FCL Path argument.
 * Falls back to a convention-based guess: "ContractNameCollection".
 */
export function getCollectionPaths(identifier: string): CollectionPaths {
  if (KNOWN_PATHS[identifier]) return KNOWN_PATHS[identifier];
  // Fallback: "A.addr.ContractName.NFT" → "ContractNameCollection"
  const contractName = identifier.split(".")[2] ?? "Unknown";
  return { storage: `${contractName}Collection`, public: `${contractName}Collection` };
}
