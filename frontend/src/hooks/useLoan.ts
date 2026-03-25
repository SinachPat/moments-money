"use client";

import { useQuery } from "@tanstack/react-query";
import { executeScript } from "@/lib/fcl";
import type { LoanInfo } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const contractAddress = ( process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "").trim();

const GET_ACTIVE_LOANS = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address, borrower: Address): [MomentsMoney.LoanInfo] {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getActiveLoans(borrower: borrower)
}`;

const GET_LOAN_INFO = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address, loanID: UInt64): MomentsMoney.LoanInfo? {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getLoanInfo(loanID: loanID)
}`;

const GET_OUTSTANDING_BALANCE = `
import MomentsMoney from 0xMomentsMoney

access(all) fun main(contractAddress: Address, loanID: UInt64): UFix64 {
    let manager = getAccount(contractAddress)
        .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
        .borrow() ?? panic("Could not borrow LoanManager from protocol address")
    return manager.getOutstandingBalance(loanID: loanID)
}`;

export function useMyLoans() {
  const { address, isLoggedIn } = useAuth();

  const { data, isLoading, refetch } = useQuery<LoanInfo[]>({
    queryKey: ["myLoans", contractAddress, address],
    queryFn: () =>
      executeScript<LoanInfo[]>(GET_ACTIVE_LOANS, (arg, t) => [
        arg(contractAddress, t.Address),
        arg(address!, t.Address),
      ]),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!contractAddress && isLoggedIn && !!address,
  });

  const allLoans = data ?? [];
  const activeLoans = allLoans.filter((l) => l.status === "Active");
  const historicalLoans = allLoans.filter((l) => l.status !== "Active");

  return { activeLoans, historicalLoans, isLoading, refetch };
}

export function useLoan(loanID: string) {
  const { data, isLoading } = useQuery<LoanInfo | null>({
    queryKey: ["loan", contractAddress, loanID],
    queryFn: () =>
      executeScript<LoanInfo | null>(GET_LOAN_INFO, (arg, t) => [
        arg(contractAddress, t.Address),
        arg(loanID, t.UInt64),
      ]),
    staleTime: 30 * 1000,
    enabled: !!contractAddress && !!loanID,
  });

  return { loan: data ?? null, isLoading };
}

export function useOutstandingBalance(loanID: string) {
  const { data, isLoading } = useQuery<string>({
    queryKey: ["outstandingBalance", contractAddress, loanID],
    queryFn: () =>
      executeScript<string>(GET_OUTSTANDING_BALANCE, (arg, t) => [
        arg(contractAddress, t.Address),
        arg(loanID, t.UInt64),
      ]),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!contractAddress && !!loanID,
  });

  return { balance: data ?? "0.00000000", isLoading };
}
