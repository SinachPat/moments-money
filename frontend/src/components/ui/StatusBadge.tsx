interface StatusBadgeProps {
  status: "Active" | "Repaid" | "Liquidated" | "Grace Period";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#16A34A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
          Active
        </span>
      );
    case "Repaid":
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          Repaid
        </span>
      );
    case "Liquidated":
      return (
        <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-medium text-[#DC2626]">
          Forfeited
        </span>
      );
    case "Grace Period":
      return (
        <span className="inline-flex animate-pulse items-center rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#D97706]">
          Grace Period — Act Now
        </span>
      );
  }
}
