export function DapperWarningBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 px-5 py-4"
    >
      <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
        ⚠
      </span>
      <p className="text-sm text-amber-900">
        <span className="font-semibold">Dapper Wallet detected.</span> Your
        Dapper Wallet doesn&apos;t support direct collateral transfers. Migrate
        your NFTs to Flow Wallet or Blocto to use Moments Money.{" "}
        <a
          href="https://support.nbatopshot.com/hc/en-us/articles/how-to-migrate"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1 font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
        >
          Migration Guide
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </a>
      </p>
    </div>
  );
}
