"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { rm } from "@/lib/format";
import { BreakEvenChart, Meter } from "@/components/charts";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export type ModelAnchors = {
  customersPerDay?: number;
  avgSpend?: number;
  cogsPct?: number;
};

const BRAND = "#5E8F45";
const POS = "#16A34A";
const NEG = "#DC2626";

const COST_COLORS = {
  cogs: "#F59E0B", // amber
  rent: "#2563EB", // info blue
  wages: "#7C3AED", // violet
  utilities: "#0EA5E9", // sky
  other: "#9CA3AF", // muted
  net: BRAND,
};

export function FinancialModel({ anchors }: { anchors?: ModelAnchors }) {
  const [a, setA] = useState({
    customersPerDay: Math.round(anchors?.customersPerDay ?? 24),
    avgSpend: Math.round(anchors?.avgSpend ?? 47),
    daysPerMonth: 26,
    cogsPct: Math.round(anchors?.cogsPct ?? 34),
    rent: 4500,
    wages: 7000,
    utilities: 900,
    other: 1500,
    capex: 150000,
  });

  function set<K extends keyof typeof a>(k: K, v: number) {
    setA((p) => ({ ...p, [k]: Number.isFinite(v) ? v : 0 }));
  }

  const m = useMemo(() => {
    const revenue = a.customersPerDay * a.avgSpend * a.daysPerMonth;
    const cogs = (revenue * a.cogsPct) / 100;
    const grossProfit = revenue - cogs;
    const grossMargin = 1 - a.cogsPct / 100;
    const fixed = a.rent + a.wages + a.utilities + a.other;
    const netProfit = grossProfit - fixed;
    const netMargin = revenue > 0 ? netProfit / revenue : 0;
    const annualNet = netProfit * 12;
    const roi = a.capex > 0 ? annualNet / a.capex : 0;
    const payback = netProfit > 0 ? a.capex / netProfit : Infinity;
    const cash12 = -a.capex + netProfit * 12;
    const series = Array.from({ length: 25 }, (_, t) => ({
      label: `M${t}`,
      value: -a.capex + netProfit * t,
    }));
    const beIndex =
      netProfit > 0 && payback <= 24 ? payback : null;
    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin,
      fixed,
      netProfit,
      netMargin,
      annualRevenue: revenue * 12,
      annualNet,
      roi,
      payback,
      cash12,
      series,
      beIndex,
    };
  }, [a]);

  const profitable = m.netProfit > 0;

  // Cost-structure stacked bar (normalised so it always fills).
  const segs = [
    { key: "cogs", label: "COGS", value: m.cogs, color: COST_COLORS.cogs },
    { key: "rent", label: "Rent", value: a.rent, color: COST_COLORS.rent },
    { key: "wages", label: "Wages", value: a.wages, color: COST_COLORS.wages },
    { key: "utilities", label: "Utilities", value: a.utilities, color: COST_COLORS.utilities },
    { key: "other", label: "Other", value: a.other, color: COST_COLORS.other },
    ...(m.netProfit > 0
      ? [{ key: "net", label: "Net Profit", value: m.netProfit, color: COST_COLORS.net }]
      : []),
  ];
  const segSum = segs.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Hero — the question + verdict */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5E8F45] via-[#5E8F45] to-[#7FB069] p-6 text-white shadow-[0_8px_24px_-8px_rgba(94,143,69,0.5)] sm:p-10">
        <p className="text-sm font-medium text-white/85">
          Financial Model · Kaki Harmoni
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Can a 500 sq ft wellness café generate sustainable profits?
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/85">
          An interactive model built from real operating assumptions — the RM40
          spa+coffee bundle, a 45-minute chair cycle, and 4 chairs. Adjust the
          levers below to test scenarios.
        </p>
        <div
          className={`mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 ${
            profitable ? "bg-white/15" : "bg-[#DC2626]/25"
          }`}
        >
          <span className="text-lg font-bold">
            {profitable ? "Yes — profitable at these assumptions." : "Not yet at these assumptions."}
          </span>
          {profitable && (
            <span className="text-sm text-white/85">
              {rm(m.netProfit)}/mo net · payback{" "}
              {isFinite(m.payback) ? `${Math.ceil(m.payback)} mo` : "—"} · ROI{" "}
              {pct(m.roi)}/yr
            </span>
          )}
        </div>
      </div>

      {/* KPIs first */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Revenue" value={rm(m.revenue)} sub={`${rm(m.annualRevenue)} / yr`} accent />
        <Kpi
          label="Net Profit"
          value={rm(m.netProfit)}
          sub={`${pct(m.netMargin)} net margin`}
          tone={m.netProfit >= 0 ? "good" : "bad"}
        />
        <Kpi label="Gross Margin" value={pct(m.grossMargin)} meter={m.grossMargin * 100} />
        <Kpi
          label="Cash Balance"
          value={rm(m.cash12)}
          sub="after 12 months"
          tone={m.cash12 >= 0 ? "good" : "bad"}
        />
        <Kpi label="Customers / Day" value={String(a.customersPerDay)} sub={`${a.daysPerMonth} days/mo`} />
        <Kpi label="Average Spend" value={rm(a.avgSpend)} sub="per customer" />
        <Kpi label="ROI" value={pct(m.roi)} sub="annual, on capex" tone={m.roi >= 0 ? "good" : "bad"} />
        <Kpi
          label="Payback"
          value={isFinite(m.payback) ? `${Math.ceil(m.payback)} mo` : "—"}
          sub={isFinite(m.payback) ? "to recoup capex" : "not reached"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Path to Payback"
          subtitle="Cumulative cash from −capex; crosses zero at break-even"
        >
          <BreakEvenChart data={m.series} breakEvenIndex={m.beIndex} />
          <p className="mt-2 text-xs text-neutral-500">
            {profitable
              ? isFinite(m.payback)
                ? `Recoups the ${rm(a.capex)} investment in ~${Math.ceil(m.payback)} months, then compounds.`
                : `Profitable, but payback is beyond 24 months at this scale.`
              : `Cash never turns positive at these assumptions — raise demand or cut fixed costs.`}
          </p>
        </Card>

        <Card title="Where each RM of revenue goes" subtitle="Monthly cost structure">
          <div className="flex h-6 w-full overflow-hidden rounded-lg">
            {segs.map((s) => (
              <div
                key={s.key}
                style={{ width: `${(s.value / segSum) * 100}%`, background: s.color }}
                title={`${s.label}: ${rm(s.value)}`}
              />
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <PnlRow label="Revenue" value={rm(m.revenue)} strong />
            <PnlRow label="− Cost of goods" value={rm(m.cogs)} color={COST_COLORS.cogs} />
            <PnlRow label="= Gross profit" value={rm(m.grossProfit)} />
            <PnlRow label="− Rent" value={rm(a.rent)} color={COST_COLORS.rent} />
            <PnlRow label="− Wages" value={rm(a.wages)} color={COST_COLORS.wages} />
            <PnlRow label="− Utilities" value={rm(a.utilities)} color={COST_COLORS.utilities} />
            <PnlRow label="− Other" value={rm(a.other)} color={COST_COLORS.other} />
            <div className="my-1 border-t border-neutral-200" />
            <PnlRow
              label="= Net profit / month"
              value={rm(m.netProfit)}
              strong
              tone={m.netProfit >= 0 ? "good" : "bad"}
            />
          </div>
        </Card>
      </div>

      {/* Assumptions — the interactive levers */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
        <h2 className="text-xl font-semibold text-[#1F2937]">Assumptions</h2>
        <p className="mb-5 mt-0.5 text-xs text-[#9CA3AF]">
          Drag or type to model scenarios — every number above updates live.
        </p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
          <Slider label="Customers / day" value={a.customersPerDay} min={0} max={60} onChange={(v) => set("customersPerDay", v)} suffix="" />
          <Slider label="Average spend" value={a.avgSpend} min={20} max={120} onChange={(v) => set("avgSpend", v)} prefix="RM" />
          <Slider label="Operating days / month" value={a.daysPerMonth} min={20} max={31} onChange={(v) => set("daysPerMonth", v)} suffix="" />
          <Slider label="Cost of goods" value={a.cogsPct} min={10} max={70} onChange={(v) => set("cogsPct", v)} suffix="%" />
          <Num label="Rent / month" value={a.rent} onChange={(v) => set("rent", v)} />
          <Num label="Wages / month" value={a.wages} onChange={(v) => set("wages", v)} />
          <Num label="Utilities / month" value={a.utilities} onChange={(v) => set("utilities", v)} />
          <Num label="Other opex / month" value={a.other} onChange={(v) => set("other", v)} />
          <Num label="Initial investment (capex)" value={a.capex} onChange={(v) => set("capex", v)} />
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="self-center text-neutral-500">Real actuals:</span>
        {[
          ["/reports", "Reports"],
          ["/sales", "Sales"],
          ["/expenses", "Purchases"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {label} →
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  meter,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  meter?: number;
  accent?: boolean;
  tone?: "good" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? "text-[#16A34A]"
      : tone === "bad"
        ? "text-[#DC2626]"
        : accent
          ? "text-[#5E8F45]"
          : "text-[#1F2937]";
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold lg:text-4xl ${valueColor}`}>{value}</p>
      {meter != null && (
        <div className="mt-2">
          <Meter pct={meter} />
        </div>
      )}
      {sub && <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#1F2937]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[#9CA3AF]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function PnlRow({
  label,
  value,
  strong,
  tone,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "bad";
  color?: string;
}) {
  const textColor =
    tone === "good"
      ? "text-[#16A34A]"
      : tone === "bad"
        ? "text-[#DC2626]"
        : strong
          ? "text-[#1F2937]"
          : "text-[#6B7280]";
  return (
    <div
      className={`flex items-center justify-between ${strong ? "font-semibold" : ""} ${textColor}`}
    >
      <span className="flex items-center gap-2">
        {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-[#6B7280]">{label}</span>
        <span className="text-sm font-semibold text-[#1F2937]">
          {prefix}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#5E8F45]"
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600">{label}</span>
      <div className="flex items-center rounded-lg border border-neutral-300 px-3">
        <span className="text-neutral-400">RM</span>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-2 py-2 outline-none"
        />
      </div>
    </label>
  );
}
