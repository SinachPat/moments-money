"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { TransactionStatus } from "./TransactionStatus";
import { useOutstandingBalance } from "@/hooks/useLoan";
import { useTransaction } from "@/hooks/useTransaction";
import { useLoan } from "@/hooks/useLoan";
import { formatFlow } from "@/lib/utils";
import { getCollectionPaths } from "@/lib/collectionPaths";

const contractAddress = process.env.NEXT_PUBLIC_MOMENTS_MONEY_ADDRESS ?? "";

const REPAY_LOAN_TX = `
import MomentsMoney from 0xMomentsMoney
import "FungibleToken"
import "NonFungibleToken"
import "FlowToken"

transaction(
    loanID: UInt64,
    repaymentAmount: UFix64,
    nftReceiverPublicPath: PublicPath,
    protocolAddress: Address
) {
    let payment: @{FungibleToken.Vault}
    let nftReceiverCap: Capability<&{NonFungibleToken.Receiver}>

    prepare(signer: auth(Storage) &Account) {
        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow FLOW vault — ensure /storage/flowTokenVault exists")

        self.payment <- flowVault.withdraw(amount: repaymentAmount)
        self.nftReceiverCap = signer.capabilities.get<&{NonFungibleToken.Receiver}>(nftReceiverPublicPath)
    }

    pre {
        self.nftReceiverCap.check(): "No NFT receiver capability at the provided path"
    }

    execute {
        let manager = getAccount(protocolAddress)
            .capabilities.get<&{MomentsMoney.LoanManagerPublic}>(MomentsMoney.LoanManagerPublicPath)
            .borrow() ?? panic("Could not borrow LoanManager from protocol address")

        manager.repayLoan(
            loanID: loanID,
            payment: <- self.payment,
            nftReceiverCap: self.nftReceiverCap
        )
    }
}`;

interface RepayModalProps {
  loanID: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RepayModal({ loanID, isOpen, onClose, onSuccess }: RepayModalProps) {
  const { loan } = useLoan(loanID);
  const { balance: outstandingBalance } = useOutstandingBalance(loanID);
  const { execute, status: txStatus, txID, reset: resetTx } = useTransaction();

  const outstandingNum = parseFloat(outstandingBalance);
  const principalNum = parseFloat(loan?.principal ?? "0");
  const interestNum = Math.max(0, outstandingNum - principalNum);

  const [repayAmount, setRepayAmount] = useState(outstandingNum);

  // Keep the default synced with live balance
  useEffect(() => {
    if (outstandingNum > 0) setRepayAmount(outstandingNum);
  }, [outstandingNum]);

  // Stable refs so the success effect never needs onSuccess/onClose in its deps
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Handle success — using refs prevents re-fire when parent passes new inline callbacks
  useEffect(() => {
    if (txStatus !== "sealed") return;
    const timer = setTimeout(() => {
      onSuccessRef.current();
      onCloseRef.current();
    }, 2000);
    return () => clearTimeout(timer);
  }, [txStatus]); // intentionally omits onSuccess/onClose — refs keep them current

  const isFullRepayment =
    Math.abs(repayAmount - outstandingNum) < 0.000001 || repayAmount >= outstandingNum;

  const nftCount = loan?.nftIDs.length ?? 0;
  const paths = loan ? getCollectionPaths(loan.collectionIdentifier) : null;

  async function handleConfirm() {
    if (!paths) return;
    resetTx();

    await execute(REPAY_LOAN_TX, (arg, t) => [
      arg(loanID, t.UInt64),
      arg(Math.min(repayAmount, outstandingNum).toFixed(8), t.UFix64),
      arg({ domain: "public", identifier: paths.public }, t.Path),
      arg(contractAddress, t.Address),
    ]);
  }

  function handleClose() {
    if (txStatus === "pending") return;
    resetTx();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Repay Loan">
      {!loan ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Loan summary */}
          <div className="rounded-card border border-[rgba(66,87,138,0.12)] bg-gray-100 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Loan #{loanID}</span>
              <span className="font-medium text-brand-dark">
                {nftCount} item{nftCount !== 1 ? "s" : ""} locked
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-gray-500">Principal</span>
              <span className="font-medium text-brand-dark">
                {formatFlow(loan.principal)}
              </span>
            </div>
          </div>

          {/* Outstanding balance */}
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium text-brand-dark">
                Outstanding balance
              </span>
              <span className="text-xs text-gray-400">Refreshes every 60s</span>
            </div>
            <div className="text-2xl font-semibold tracking-heading text-brand-dark">
              {formatFlow(outstandingBalance)}
            </div>
            {interestNum > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {formatFlow(principalNum.toFixed(8))} principal +{" "}
                {formatFlow(interestNum.toFixed(8))} interest
              </p>
            )}
          </div>

          {/* Amount input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-brand-dark">
              Repayment amount
            </label>
            <div className="relative">
              <input
                type="number"
                min={0.00000001}
                max={outstandingNum}
                step={0.00000001}
                value={repayAmount}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setRepayAmount(Math.min(v, outstandingNum));
                }}
                disabled={txStatus === "pending"}
                className="h-11 w-full rounded border border-[rgba(66,87,138,0.15)] px-4 pr-16 text-sm font-medium text-brand-dark focus:border-brand-orange focus:outline-none disabled:opacity-50"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                FLOW
              </span>
            </div>
            <button
              onClick={() => setRepayAmount(outstandingNum)}
              className="mt-1.5 text-xs font-medium text-brand-orange hover:opacity-75"
            >
              Pay full balance
            </button>
          </div>

          {/* Partial / full message */}
          <div
            className={[
              "rounded border px-4 py-3 text-xs leading-relaxed",
              isFullRepayment
                ? "border-[#DCFCE7] bg-[#DCFCE7] text-[#16A34A]"
                : "border-amber-200 bg-amber-50 text-amber-800",
            ].join(" ")}
          >
            {isFullRepayment
              ? `Full repayment — your ${nftCount} item${nftCount !== 1 ? "s" : ""} will be returned immediately.`
              : "Partial repayment — your items remain locked until the loan is fully repaid."}
          </div>

          {/* Transaction status */}
          {txStatus !== "idle" && (
            <TransactionStatus
              status={txStatus}
              txID={txID}
              successMessage={
                isFullRepayment
                  ? `Repaid! Your ${nftCount} item${nftCount !== 1 ? "s" : ""} are being returned.`
                  : "Partial repayment confirmed."
              }
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              isLoading={txStatus === "pending"}
              disabled={txStatus === "pending" || repayAmount <= 0}
              onClick={handleConfirm}
            >
              Confirm Repayment
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleClose}
              disabled={txStatus === "pending"}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
