"use client";

import { useQuery } from "@tanstack/react-query";
import { executeScript } from "@/lib/fcl";
import type { CollectionConfig } from "@/lib/types";

const contractAddress = process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "";

const GET_ALL_COLLECTIONS = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address): [MomentsMoney.CollectionConfig] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getAllCollections()
}`;

const GET_COLLECTION_CONFIG = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address, identifier: String): MomentsMoney.CollectionConfig? {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getCollectionConfig(identifier: identifier)
}`;

const GET_MAX_BORROW = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address, collectionIdentifier: String, nftCount: UInt64): UFix64 {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getMaxBorrowAmount(identifier: collectionIdentifier, nftCount: nftCount)
}`;

/** Returns all collections including inactive ones — used for admin/display views. */
export function useAllCollections() {
  const { data, isLoading, error } = useQuery<CollectionConfig[]>({
    queryKey: ["allCollections", contractAddress],
    queryFn: () =>
      executeScript<CollectionConfig[]>(GET_ALL_COLLECTIONS, (arg, t) => [
        arg(contractAddress, t.Address),
      ]),
    staleTime: 5 * 60 * 1000,
    enabled: !!contractAddress,
    // No select filter — returns both active and inactive
  });

  return { collections: data ?? [], isLoading, error };
}

/** Returns active-only collections — use this for borrow flow and UI selectors. */
export function useCollections() {
  const { data, isLoading, error, refetch } = useQuery<CollectionConfig[]>({
    queryKey: ["collections", contractAddress],
    queryFn: () =>
      executeScript<CollectionConfig[]>(GET_ALL_COLLECTIONS, (arg, t) => [
        arg(contractAddress, t.Address),
      ]),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!contractAddress,
    select: (data) => data.filter((c) => c.isActive),
  });

  return {
    collections: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export function useCollectionConfig(identifier: string) {
  const { data, isLoading } = useQuery<CollectionConfig | null>({
    queryKey: ["collectionConfig", contractAddress, identifier],
    queryFn: () =>
      executeScript<CollectionConfig | null>(GET_COLLECTION_CONFIG, (arg, t) => [
        arg(contractAddress, t.Address),
        arg(identifier, t.String),
      ]),
    staleTime: 5 * 60 * 1000,
    enabled: !!contractAddress && !!identifier,
  });

  return { config: data ?? null, isLoading };
}

export function useMaxBorrowAmount(identifier: string, nftCount: number) {
  const { data, isLoading } = useQuery<string>({
    queryKey: ["maxBorrow", contractAddress, identifier, nftCount],
    queryFn: () =>
      executeScript<string>(GET_MAX_BORROW, (arg, t) => [
        arg(contractAddress, t.Address),
        arg(identifier, t.String),
        arg(String(nftCount), t.UInt64),
      ]),
    staleTime: 60 * 1000,
    enabled: !!contractAddress && !!identifier && nftCount > 0,
  });

  return { maxBorrow: data ?? "0.00000000", isLoading };
}
