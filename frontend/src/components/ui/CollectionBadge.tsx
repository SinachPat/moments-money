interface CollectionBadgeProps {
  identifier: string;
  displayName: string;
  tier: 1 | 2 | 3;
}

const tierDot: Record<number, string> = {
  1: "bg-yellow-400",   // gold
  2: "bg-gray-300",    // silver
  3: "bg-amber-600",   // bronze
};

const tierLabel: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

export function CollectionBadge({ identifier, displayName, tier }: CollectionBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(66,87,138,0.15)] bg-white px-2.5 py-1 text-xs font-medium text-brand-dark"
      title={`${tierLabel[tier]} — ${identifier}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tierDot[tier]}`} />
      {displayName}
    </span>
  );
}
