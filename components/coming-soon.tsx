export function ComingSoon({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#096ab7] bg-[#eaf6ff] px-4 py-3" role="status">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#096ab7]">Coming soon</p>
        <p className="mt-1 text-sm font-semibold text-[#11131b]">{title}</p>
        <p className="mt-1 text-sm text-[#11131b]">{detail}</p>
      </div>
      {children}
    </div>
  );
}
