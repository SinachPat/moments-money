# Moments Money

NFT-backed micro-lending protocol on the Flow blockchain. Borrow FLOW tokens against your NBA Top Shot Moments and other Flow NFTs.

## Structure

```
contracts/     Cadence smart contracts
transactions/  Cadence transactions (borrower, admin, public)
scripts/       Cadence read-only scripts
tests/         Contract and integration tests
frontend/      Next.js 14 web application
services/      Off-chain automation services
```

## Quick Start

### Prerequisites
- [Flow CLI](https://docs.onflow.org/flow-cli/install/)
- Node.js 18+

### Local Development

```bash
# Start Flow emulator
flow emulator

# Deploy contracts
flow project deploy --network emulator

# Run frontend
cd frontend && npm install && npm run dev
```

## Networks

| Network  | Contract Address |
|----------|-----------------|
| Testnet  | TBD             |
| Mainnet  | TBD             |
