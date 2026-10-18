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
      <div className="rounded-2xl border border-[#1E6A83] bg-[#E9F7FA] px-4 py-3" role="status">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Coming soon</p>
        <p className="mt-1 text-sm font-semibold text-[#203337]">{title}</p>
        <p className="mt-1 text-sm text-[#203337]">{detail}</p>
      </div>
      {children}
    </div>
  );
}
