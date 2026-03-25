#!/bin/bash
# register-testnet-collections.sh
# Registers 3 NFT collections as accepted collateral on the Moments Money
# testnet deployment. Must be run from the repo root after:
#   1. Setting testnet-deployer address in flow.json
#   2. Placing the private key in ./testnet-deployer.pkey
#   3. Deploying MomentsMoney.cdc to testnet (flow project deploy --network testnet)
#
# Usage:
#   chmod +x scripts/register-testnet-collections.sh
#   ./scripts/register-testnet-collections.sh

set -e

NETWORK="testnet"
SIGNER="testnet-deployer"
TX="./transactions/admin/add_collection.cdc"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Moments Money — Testnet Collection Registration"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Collection 1: NBA Top Shot (Tier 1 — flagship) ──────────────────────────
# The most liquid Flow NFT collection. Highest LTV at 50%.
# Floor price set conservatively at 5 FLOW for testnet simulation.
#
# Identifier format: A.{contractAddress}.{ContractName}.NFT
# Testnet TopShot contract: 0x877931736ee77cdb
echo "▶  Registering NBA Top Shot..."
flow transactions send "$TX" \
  "A.877931736ee77cdb.TopShot.NFT" \
  "NBA Top Shot" \
  "5.00000000" \
  "0.50000000" \
  "0.15000000" \
  "2592000.00000000" \
  1 \
  --signer "$SIGNER" \
  --network "$NETWORK" \
  --gas-limit 9999

echo "✓  NBA Top Shot registered"
echo ""

# ── Collection 2: NFL All Day (Tier 2 — mid-tier) ───────────────────────────
# Second-largest Flow sports NFT collection. 45% LTV, slightly higher rate.
# Testnet AllDay contract: 0x4dfd62c88d1b6462
echo "▶  Registering NFL All Day..."
flow transactions send "$TX" \
  "A.4dfd62c88d1b6462.AllDay.NFT" \
  "NFL All Day" \
  "3.00000000" \
  "0.45000000" \
  "0.18000000" \
  "2592000.00000000" \
  2 \
  --signer "$SIGNER" \
  --network "$NETWORK" \
  --gas-limit 9999

echo "✓  NFL All Day registered"
echo ""

# ── Collection 3: UFC Strike (Tier 3 — emerging) ────────────────────────────
# Lower liquidity than Top Shot/AllDay — conservative 40% LTV and 15-day cap.
# Testnet UFC_NFT contract: 0x329feb3ab062d289
echo "▶  Registering UFC Strike..."
flow transactions send "$TX" \
  "A.329feb3ab062d289.UFC_NFT.NFT" \
  "UFC Strike" \
  "2.00000000" \
  "0.40000000" \
  "0.20000000" \
  "1296000.00000000" \
  3 \
  --signer "$SIGNER" \
  --network "$NETWORK" \
  --gas-limit 9999

echo "✓  UFC Strike registered"
echo ""

# ── Verify ────────────────────────────────────────────────────────────────────
echo "▶  Verifying — fetching all registered collections..."
flow scripts execute ./scripts/get_all_collections.cdc \
  0x5f48399c13df4365 \
  --network "$NETWORK"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  All 3 collections registered successfully ✓"
echo "═══════════════════════════════════════════════════"
echo ""
