// Downloads an .xlsx from /api/export/<type>. Plain anchor so it works in both
// server and client components; the browser handles the file download.
export function ExportButton({
  type,
  date,
  label = "Export to Excel",
}: {
  type: "sessions" | "products" | "expenses" | "reimbursements" | "report";
  date?: string;
  label?: string;
}) {
  const href = `/api/export/${type}${date ? `?date=${date}` : ""}`;
  return (
    <a
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
    >
      ⬇ {label}
    </a>
  );
}
