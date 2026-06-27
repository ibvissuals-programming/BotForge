import type { Business, Lead } from "@/lib/types";

// Wraps a cell value in double-quotes and escapes any embedded double-quotes
// per RFC 4180 (the standard CSV quoting rule).
function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Generates a CSV file from a leads array and triggers a browser download.
// Column order: Business Name, Date, Customer Name, Services Interested,
//               Booking Intent, Questions Asked, Contacted.
export function exportLeadsToCSV(leads: Lead[], bizMap: Record<string, Business | undefined>): void {
  const headers = [
    "Business Name",
    "Date",
    "Customer Name",
    "Services Interested",
    "Booking Intent",
    "Questions Asked",
    "Contacted",
  ];

  const rows = leads.map((lead) => [
    csvEscape(bizMap[lead.businessId]?.bizName ?? lead.businessId),
    csvEscape(new Date(lead.timestamp).toLocaleString()),
    csvEscape(lead.customerName ?? ""),
    csvEscape(lead.servicesInterested.join("; ")),
    csvEscape(lead.bookingIntent),
    csvEscape(lead.questionsAsked.join("; ")),
    csvEscape(lead.contacted ? "Yes" : "No"),
  ]);

  const csv = [headers.map(csvEscape), ...rows]
    .map((row) => row.join(","))
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `botforge-leads-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
