/**
 * Ambient background made from CSS gradients rather than bitmap art.
 * It gives the pages the soft, layered depth of the reference design
 * without shipping (or tracing) its assets.
 */
export default function PageIllustration({
  multiple = false,
}: {
  multiple?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(197,68,54,0.18),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(197,68,54,0.24),transparent)]" />
      <div className="absolute top-24 left-[8%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(39,174,96,0.16),transparent)] blur-3xl" />
      <div className="absolute top-40 right-[6%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(closest-side,rgba(230,126,34,0.14),transparent)] blur-3xl" />
      {multiple && (
        <div className="absolute top-[560px] left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(44,62,80,0.12),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(255,255,255,0.06),transparent)]" />
      )}
    </div>
  );
}
