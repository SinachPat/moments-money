const SECONDS_PER_YEAR = 365 * 24 * 3600;

/** Formats a UFix64 string as "123.45 FLOW" */
export function formatFlow(amount: string, decimals = 2): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0.00 FLOW";
  return `${num.toFixed(decimals)} FLOW`;
}

/** Converts a FLOW amount string to approximate USD string */
export function formatUSD(flowAmount: string, flowPriceUSD: number): string {
  const num = parseFloat(flowAmount);
  if (isNaN(num)) return "$0.00";
  return `$${(num * flowPriceUSD).toFixed(2)}`;
}

/** Returns human-readable time remaining and urgency level */
export function formatTimeRemaining(expiryTime: string): {
  text: string;
  urgency: "safe" | "warning" | "critical";
} {
  const expiryMs = parseFloat(expiryTime) * 1000;
  const nowMs = Date.now();
  const diffMs = expiryMs - nowMs;

  if (diffMs <= 0) {
    return { text: "Expired", urgency: "critical" };
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  let text: string;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    text = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else {
    text = `${minutes}m`;
  }

  const urgency =
    diffMs < 6 * 3600 * 1000
      ? "critical"
      : diffMs < 24 * 3600 * 1000
        ? "warning"
        : "safe";

  return { text, urgency };
}

/** Returns max borrowable FLOW: floorPrice × ltvRatio × count */
export function calculateMaxBorrow(
  floorPrice: string,
  ltvRatio: string,
  count: number,
): string {
  const result = parseFloat(floorPrice) * parseFloat(ltvRatio) * count;
  return result.toFixed(8);
}

/** Simple interest: principal × rate × durationSeconds / SECONDS_PER_YEAR */
export function calculateInterest(
  principal: string,
  rate: string,
  durationSeconds: string,
): string {
  const interest =
    parseFloat(principal) *
    parseFloat(rate) *
    (parseFloat(durationSeconds) / SECONDS_PER_YEAR);
  return interest.toFixed(8);
}

/** Total repayment = principal + simple interest */
export function calculateTotalRepayment(
  principal: string,
  rate: string,
  durationSeconds: string,
): string {
  const total =
    parseFloat(principal) +
    parseFloat(calculateInterest(principal, rate, durationSeconds));
  return total.toFixed(8);
}

/** Shortens a Flow address to "0xf8d6...0c7a" */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
