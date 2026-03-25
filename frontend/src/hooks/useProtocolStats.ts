"use client";

import { useQuery } from "@tanstack/react-query";
import { executeScript } from "@/lib/fcl";
import type { ProtocolStats } from "@/lib/types";

const contractAddress = process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "";

const GET_PROTOCOL_STATS = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address): MomentsMoney.ProtocolStats {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getProtocolStats()
}`;

export function useProtocolStats() {
  const { data, isLoading } = useQuery<ProtocolStats>({
    queryKey: ["protocolStats", contractAddress],
    queryFn: () =>
      executeScript<ProtocolStats>(GET_PROTOCOL_STATS, (arg, t) => [
        arg(contractAddress, t.Address),
      ]),
    staleTime: 30 * 1000,
    enabled: !!contractAddress,
  });

  return { stats: data ?? null, isLoading };
}
