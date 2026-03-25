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
  }
> = {
  testnet: {
    accessNode: "https://rest-testnet.onflow.org",
    walletDiscovery: "https://fcl-discovery.onflow.org/testnet/authn",
    authnEndpoint: "https://fcl-discovery.onflow.org/api/testnet/authn",
  },
  mainnet: {
    accessNode: "https://rest-mainnet.onflow.org",
    walletDiscovery: "https://fcl-discovery.onflow.org/authn",
    authnEndpoint: "https://fcl-discovery.onflow.org/api/authn",
  },
};

const { accessNode, walletDiscovery, authnEndpoint } =
  networkConfig[network] ?? networkConfig.testnet;

fcl.config({
  "app.detail.title": "Moments Money",
  "app.detail.icon": "/logo.png",
  "flow.network": network,
  "accessNode.api": accessNode,
  "discovery.wallet": walletDiscovery,
  // Required for fcl.discovery.authn.subscribe() used by our custom wallet picker.
  // We filter Blocto client-side in WalletButton.tsx rather than relying on
  // discovery.authn.exclude, which has a postMessage key mismatch in FCL 1.x.
  "discovery.authn.endpoint": authnEndpoint,
  "0xMomentsMoney": process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "0x",
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
