import { getDashboard } from "@/lib/dashboard";
import { FinancialModel, type ModelAnchors } from "@/components/FinancialModel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();

  // Seed the model's defaults from real operating data where we have it.
  const anchors: ModelAnchors = {};
  if (d.sessions > 0 && d.activeDays > 0)
    anchors.customersPerDay = d.transactions / d.activeDays;
  if (d.avgTicket > 0) anchors.avgSpend = d.avgTicket;
  if (d.revenue > 0) anchors.cogsPct = (1 - d.grossMargin) * 100;

  return <FinancialModel anchors={anchors} />;
}
