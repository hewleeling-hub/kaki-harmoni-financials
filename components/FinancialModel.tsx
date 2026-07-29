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

const COST_COLORS = {
  cogs: "#F59E0B",
  rent: "#2563EB",
  wages: "#7C3AED",
  utilities: "#0EA5E9",
  other: "#9CA3AF",
  net: BRAND,
};

const CHAIRS = 4;
const SESSIONS_PER_CHAIR_DAY = 13; // 10:00–20:00 over a 45-min cycle
const CAPACITY_PER_DAY = CHAIRS * SESSIONS_PER_CHAIR_DAY;

const PRESETS: Record<string, { customersPerDay: number; avgSpend: number; cogsPct: number }> = {
  Conservative: { customersPerDay: 16, avgSpend: 42, cogsPct: 38 },
  Base: { customersPerDay: 24, avgSpend: 47, cogsPct: 34 },
  Aggressive: { customersPerDay: 36, avgSpend: 55, cogsPct: 30 },
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
  function applyPreset(name: keyof typeof PRESETS) {
    setA((p) => ({ ...p, ...PRESETS[name] }));
  }

  const m = useMemo(() => {
    const revenue = a.customersPerDay * a.avgSpend * a.daysPerMonth;
    const cogs = (revenue * a.cogsPct) / 100;
    const grossProfit = revenue - cogs;
    const grossMargin = 1 - a.cogsPct / 100;
    const fixed = a.rent + a.wages + a.utilities + a.other;
    const totalCost = cogs + fixed;
    const netProfit = grossProfit - fixed;
    const netMargin = revenue > 0 ? netProfit / revenue : 0;
    const annualRevenue = revenue * 12;
    const annualNet = netProfit * 12;
    const roi = a.capex > 0 ? annualNet / a.capex : 0;
    const payback = netProfit > 0 ? a.capex / netProfit : Infinity;
    const cash12 = -a.capex + netProfit * 12;
    const cash24 = -a.capex + netProfit * 24;
    const capacityMonthly = CAPACITY_PER_DAY * a.daysPerMonth * a.avgSpend;
    const utilVsCapacity =
      capacityMonthly > 0 ? Math.min(1, revenue / capacityMonthly) : 0;
    const horizon = Math.min(
      60,
      Math.max(24, isFinite(payback) ? Math.ceil(payback) + 3 : 24),
    );
    const series = Array.from({ length: horizon + 1 }, (_, t) => ({
      label: `M${t}`,
      value: -a.capex + netProfit * t,
    }));
    const beIndex = netProfit > 0 && payback <= horizon ? payback : null;
    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin,
      fixed,
      totalCost,
      netProfit,
      netMargin,
      annualRevenue,
      annualNet,
      roi,
      payback,
      cash12,
      cash24,
      capacityMonthly,
      utilVsCapacity,
      series,
      beIndex,
    };
  }, [a]);

  const profitable = m.netProfit > 0;
  const paybackTxt = isFinite(m.payback) ? `${Math.ceil(m.payback)} mo` : "—";

  const costs = [
    { key: "cogs", label: "Cost of goods", value: m.cogs, color: COST_COLORS.cogs },
    { key: "rent", label: "Rent", value: a.rent, color: COST_COLORS.rent },
    { key: "wages", label: "Wages", value: a.wages, color: COST_COLORS.wages },
    { key: "utilities", label: "Utilities", value: a.utilities, color: COST_COLORS.utilities },
    { key: "other", label: "Other opex", value: a.other, color: COST_COLORS.other },
  ];
  const largest = [...costs].sort((x, y) => y.value - x.value)[0];
  const segs = [
    ...costs,
    ...(m.netProfit > 0
      ? [{ key: "net", label: "Net Profit", value: m.netProfit, color: COST_COLORS.net }]
      : []),
  ];
  const segSum = segs.reduce((s, x) => s + x.value, 0) || 1;
  const revMax = Math.max(m.revenue, 1);

  return (
    <div className="space-y-8">
      {/* Framing banner */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5E8F45] via-[#5E8F45] to-[#7FB069] p-6 text-white shadow-[0_8px_24px_-8px_rgba(94,143,69,0.5)] sm:p-10">
        <p className="text-sm font-medium text-white/85">Financial Model · Kaki Harmoni</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Can a 500 sq ft wellness café generate sustainable profits?
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/85">
          An interactive model built from real operating assumptions — the RM40
          spa+coffee bundle, a 45-minute chair cycle, and 4 chairs.
        </p>
      </div>

      {/* 1 · Executive Summary */}
      <Section
        n={1}
        title="Executive Summary"
        summary={
          profitable
            ? `At ${a.customersPerDay} customers/day and ${rm(a.avgSpend)} average spend, the café turns ${rm(m.revenue)}/mo of revenue into ${rm(m.netProfit)}/mo net profit (${pct(m.netMargin)} margin) — recouping the ${rm(a.capex)} investment in ${paybackTxt} at a ${pct(m.roi)} annual return.`
            : `At ${a.customersPerDay} customers/day and ${rm(a.avgSpend)} average spend, revenue of ${rm(m.revenue)}/mo does not yet cover ${rm(m.totalCost)}/mo of costs — a ${rm(m.netProfit)}/mo shortfall. Raise demand or trim fixed costs to reach break-even.`
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Revenue" value={rm(m.revenue)} sub={`${rm(m.annualRevenue)} / yr`} accent />
          <Kpi label="Net Profit" value={rm(m.netProfit)} sub={`${pct(m.netMargin)} net margin`} tone={profitable ? "good" : "bad"} />
          <Kpi label="Gross Margin" value={pct(m.grossMargin)} meter={m.grossMargin * 100} />
          <Kpi label="Cash Balance" value={rm(m.cash12)} sub="after 12 months" tone={m.cash12 >= 0 ? "good" : "bad"} />
          <Kpi label="Customers / Day" value={String(a.customersPerDay)} sub={`${a.daysPerMonth} days/mo`} />
          <Kpi label="Average Spend" value={rm(a.avgSpend)} sub="per customer" />
          <Kpi label="ROI" value={pct(m.roi)} sub="annual, on capex" tone={m.roi >= 0 ? "good" : "bad"} />
          <Kpi label="Payback" value={paybackTxt} sub={isFinite(m.payback) ? "to recoup capex" : "not reached"} />
        </div>
      </Section>

      {/* 2 · Revenue */}
      <Section
        n={2}
        title="Revenue"
        summary={`Revenue is ${rm(m.revenue)}/mo (${rm(m.annualRevenue)}/yr), driven by ${a.customersPerDay} customers/day × ${rm(a.avgSpend)} spend × ${a.daysPerMonth} days. At full 4-chair capacity that's ${rm(m.capacityMonthly)}/mo — the café is running at ${pct(m.utilVsCapacity)} of capacity, leaving headroom to grow with no extra fixed cost.`}
      >
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Mini label="Monthly" value={rm(m.revenue)} />
            <Mini label="Annual" value={rm(m.annualRevenue)} />
            <Mini label="Capacity / mo" value={rm(m.capacityMonthly)} />
            <Mini label="Utilisation" value={pct(m.utilVsCapacity)} />
          </div>
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-[#6B7280]">
              <span>Current vs full-capacity revenue</span>
              <span className="font-semibold">{pct(m.utilVsCapacity)}</span>
            </div>
            <Meter pct={m.utilVsCapacity * 100} />
          </div>
        </Card>
      </Section>

      {/* 3 · Expenses */}
      <Section
        n={3}
        title="Expenses"
        summary={`Monthly costs total ${rm(m.totalCost)} — ${rm(m.cogs)} cost of goods (${a.cogsPct}% of sales) plus ${rm(m.fixed)} fixed overhead. The largest single line is ${largest.label} at ${rm(largest.value)}.`}
      >
        <Card title="Where each RM of revenue goes" subtitle="Monthly cost structure">
          <div className="flex h-6 w-full overflow-hidden rounded-lg">
            {segs.map((s) => (
              <div key={s.key} style={{ width: `${(s.value / segSum) * 100}%`, background: s.color }} title={`${s.label}: ${rm(s.value)}`} />
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <PnlRow label="Revenue" value={rm(m.revenue)} strong />
            {costs.map((c) => (
              <PnlRow key={c.key} label={`− ${c.label}`} value={rm(c.value)} color={c.color} />
            ))}
            <div className="my-1 border-t border-[#E5E7EB]" />
            <PnlRow label="= Total costs" value={rm(m.totalCost)} strong />
          </div>
        </Card>
      </Section>

      {/* 4 · Profitability */}
      <Section
        n={4}
        title="Profitability"
        summary={
          profitable
            ? `Gross margin is ${pct(m.grossMargin)} and net margin ${pct(m.netMargin)}. After every cost, the café keeps ${rm(m.netProfit)}/mo (${rm(m.annualNet)}/yr).`
            : `Gross margin is a healthy ${pct(m.grossMargin)}, but fixed overhead of ${rm(m.fixed)}/mo outweighs the ${rm(m.grossProfit)} gross profit — a ${rm(m.netProfit)}/mo loss until volume rises.`
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Revenue → Profit">
            <div className="space-y-3">
              <ProfitBar label="Revenue" value={m.revenue} max={revMax} color="#CBD5E1" />
              <ProfitBar label="Gross profit" value={m.grossProfit} max={revMax} color="#7FB069" />
              <ProfitBar label="Net profit" value={m.netProfit} max={revMax} color={BRAND} />
            </div>
          </Card>
          <Card title="Margins">
            <div className="space-y-4">
              <MarginMeter label="Gross margin" value={m.grossMargin} />
              <MarginMeter label="Net margin" value={m.netMargin} tone={m.netMargin >= 0 ? "good" : "bad"} />
            </div>
          </Card>
        </div>
      </Section>

      {/* 5 · Cash Flow */}
      <Section
        n={5}
        title="Cash Flow"
        summary={
          profitable
            ? `Starting ${rm(a.capex)} in the red, cumulative cash turns positive in month ${paybackTxt}. Balance is ${rm(m.cash12)} after 12 months and ${rm(m.cash24)} after 24 — then it compounds.`
            : `Cumulative cash never turns positive at these assumptions: ${rm(m.cash12)} after 12 months, ${rm(m.cash24)} after 24. The model needs more demand or lower fixed costs.`
        }
      >
        <Card title="Path to Payback" subtitle="Cumulative cash from −capex; crosses zero at break-even">
          <BreakEvenChart data={m.series} breakEvenIndex={m.beIndex} />
        </Card>
      </Section>

      {/* 6 · Scenario Simulator */}
      <Section
        n={6}
        title="Scenario Simulator"
        summary="Pick a preset or drag the demand levers — every figure above recalculates instantly. Conservative, Base and Aggressive reflect low, expected and stretch trading."
      >
        <Card>
          <div className="mb-5 flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((name) => {
              const p = PRESETS[name];
              const active =
                a.customersPerDay === p.customersPerDay &&
                a.avgSpend === p.avgSpend &&
                a.cogsPct === p.cogsPct;
              return (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    active
                      ? "border-[#5E8F45] bg-[#5E8F45] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#CBD5E1]"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <Slider label="Customers / day" value={a.customersPerDay} min={0} max={CAPACITY_PER_DAY} onChange={(v) => set("customersPerDay", v)} />
            <Slider label="Average spend" value={a.avgSpend} min={20} max={120} onChange={(v) => set("avgSpend", v)} prefix="RM" />
            <Slider label="Operating days / month" value={a.daysPerMonth} min={20} max={31} onChange={(v) => set("daysPerMonth", v)} />
            <Slider label="Cost of goods" value={a.cogsPct} min={10} max={70} onChange={(v) => set("cogsPct", v)} suffix="%" />
          </div>
        </Card>
      </Section>

      {/* 7 · Investment */}
      <Section
        n={7}
        title="Investment"
        summary={
          profitable
            ? `A ${rm(a.capex)} build-out (fit-out, spa chairs, equipment, deposits) returns ${rm(m.annualNet)}/yr — a ${pct(m.roi)} annual ROI with a ${paybackTxt} payback.`
            : `A ${rm(a.capex)} build-out does not yet return a profit at these assumptions — payback is not reached.`
        }
      >
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Mini label="Initial capex" value={rm(a.capex)} />
            <Mini label="Annual net" value={rm(m.annualNet)} tone={m.annualNet >= 0 ? "good" : "bad"} />
            <Mini label="ROI (yr)" value={pct(m.roi)} tone={m.roi >= 0 ? "good" : "bad"} />
            <Mini label="Payback" value={paybackTxt} />
          </div>
          <div className="mt-5 max-w-sm">
            <Num label="Initial investment (capex)" value={a.capex} onChange={(v) => set("capex", v)} />
          </div>
        </Card>
      </Section>

      {/* 8 · Assumptions */}
      <Section
        n={8}
        title="Assumptions"
        summary="Every input behind the model. Fixed monthly overheads are set here; demand levers live in the Scenario Simulator above."
      >
        <Card>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Num label="Rent / month" value={a.rent} onChange={(v) => set("rent", v)} />
            <Num label="Wages / month" value={a.wages} onChange={(v) => set("wages", v)} />
            <Num label="Utilities / month" value={a.utilities} onChange={(v) => set("utilities", v)} />
            <Num label="Other opex / month" value={a.other} onChange={(v) => set("other", v)} />
          </div>
          <div className="mt-6 rounded-xl bg-[#F7F9FC] p-4 text-sm">
            <p className="mb-2 font-medium text-[#1F2937]">Model recap</p>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              <PnlRow label="Customers / day" value={String(a.customersPerDay)} />
              <PnlRow label="Average spend" value={rm(a.avgSpend)} />
              <PnlRow label="Operating days / month" value={String(a.daysPerMonth)} />
              <PnlRow label="Cost of goods" value={`${a.cogsPct}%`} />
              <PnlRow label="Fixed overhead / month" value={rm(m.fixed)} />
              <PnlRow label="Initial investment" value={rm(a.capex)} />
            </div>
          </div>
        </Card>
      </Section>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="self-center text-[#6B7280]">Real actuals:</span>
        {[
          ["/reports", "Reports"],
          ["/sales", "Sales"],
          ["/expenses", "Purchases"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium text-[#6B7280] hover:border-[#CBD5E1]">
            {label} →
          </Link>
        ))}
        <a
          href="/api/backup"
          className="ml-auto rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium text-[#6B7280] hover:border-[#CBD5E1]"
        >
          ⬇ Download data backup
        </a>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  summary,
  children,
}: {
  n: number;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5E8F45]/10 text-xs font-semibold text-[#5E8F45]">
            {n}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1F2937] sm:text-3xl">
            {title}
          </h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6B7280]">
          {summary}
        </p>
      </div>
      {children}
    </section>
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
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const c = tone === "good" ? "text-[#16A34A]" : tone === "bad" ? "text-[#DC2626]" : "text-[#1F2937]";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className={`mt-1 text-xl font-bold ${c}`}>{value}</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
      {title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-[#1F2937]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#9CA3AF]">{subtitle}</p>}
        </div>
      )}
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
    <div className={`flex items-center justify-between ${strong ? "font-semibold" : ""} ${textColor}`}>
      <span className="flex items-center gap-2">
        {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ProfitBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-[#6B7280]">{label}</span>
        <span className={`font-semibold tabular-nums ${value < 0 ? "text-[#DC2626]" : "text-[#1F2937]"}`}>
          {rm(value)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

function MarginMeter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-[#6B7280]">{label}</span>
        <span
          className={`font-semibold ${
            tone === "bad" ? "text-[#DC2626]" : tone === "good" ? "text-[#16A34A]" : "text-[#1F2937]"
          }`}
        >
          {pct(value)}
        </span>
      </div>
      <Meter pct={Math.max(0, value * 100)} color={tone === "bad" ? "#DC2626" : BRAND} />
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
      <span className="mb-1 block text-[#6B7280]">{label}</span>
      <div className="flex items-center rounded-lg border border-[#E5E7EB] px-3">
        <span className="text-[#9CA3AF]">RM</span>
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
