import * as fcl from "@onflow/fcl";

const network = process.env.NEXT_PUBLIC_FLOW_NETWORK ?? "testnet";

const networkConfig: Record<
  string,
  {
    accessNode: string;
    walletDiscovery: string;
    // HTTP endpoint used by fcl.discovery.authn.subscribe() — distinct from
    // walletDiscovery which is the iframe URL for the hosted picker.
    authnEndpoint: string;
    // System contract addresses (differ between testnet and mainnet)
    NonFungibleToken: string;
    MetadataViews: string;
    FungibleToken: string;
    FlowToken: string;
  }
> = {
  testnet: {
    accessNode: "https://rest-testnet.onflow.org",
    walletDiscovery: "https://fcl-discovery.onflow.org/testnet/authn",
    authnEndpoint: "https://fcl-discovery.onflow.org/api/testnet/authn",
    NonFungibleToken: "0x631e88ae7f1d7c20",
    MetadataViews: "0x631e88ae7f1d7c20",
    FungibleToken: "0x9a0766d93b6608b7",
    FlowToken: "0x7e60df042a9c0868",
  },
  mainnet: {
    accessNode: "https://rest-mainnet.onflow.org",
    walletDiscovery: "https://fcl-discovery.onflow.org/authn",
    authnEndpoint: "https://fcl-discovery.onflow.org/api/authn",
    NonFungibleToken: "0x1d7e57aa55817448",
    MetadataViews: "0x1d7e57aa55817448",
    FungibleToken: "0xf233dcee88fe0abe",
    FlowToken: "0x1654653399040a61",
  },
};

const cfg = networkConfig[network] ?? networkConfig.testnet;

fcl.config({
  "app.detail.title": "Moments Money",
  "app.detail.icon": "/logo.png",
  "flow.network": network,
  "accessNode.api": cfg.accessNode,
  "discovery.wallet": cfg.walletDiscovery,
  // Required for fcl.discovery.authn.subscribe() used by our custom wallet picker.
  // We filter Blocto client-side in WalletButton.tsx rather than relying on
  // discovery.authn.exclude, which has a postMessage key mismatch in FCL 1.x.
  "discovery.authn.endpoint": cfg.authnEndpoint,
  "0xMomentsMoney": (process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "0x").trim(),
  // System contract aliases — FCL substitutes these in import statements
  "0xNonFungibleToken": cfg.NonFungibleToken,
  "0xMetadataViews": cfg.MetadataViews,
  "0xFungibleToken": cfg.FungibleToken,
  "0xFlowToken": cfg.FlowToken,
});

export { fcl };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FclArgFn = (arg: any, t: any) => unknown[];

/** Execute a read-only Cadence script and return the typed result. */
export async function executeScript<T>(
  code: string,
  args: FclArgFn = () => [],
): Promise<T> {
  return fcl.query({ cadence: code, args }) as Promise<T>;
}

/** Send a Cadence transaction and return the transaction ID. */
export async function sendTransaction(
  code: string,
  args: FclArgFn = () => [],
  limit = 9999,
): Promise<string> {
  return fcl.mutate({ cadence: code, args, limit }) as Promise<string>;
}

/** Poll until a transaction reaches Sealed status, then return the result. */
export async function waitForTransaction(txID: string): Promise<unknown> {
  return fcl.tx(txID).onceSealed();
}
