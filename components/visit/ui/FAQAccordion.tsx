"use client";

import { useState } from "react";
import { ChevronDownIcon } from "./icons";

interface QA {
  q: string;
  a: string;
}

/** Accessible accordion — one panel open at a time, full keyboard support. */
export function FAQAccordion({ items }: { items: readonly QA[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-ivory">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${i}`;
        const btnId = `faq-btn-${i}`;
        return (
          <div key={item.q}>
            <h3 className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[17px] font-semibold text-olive-dark">
                  {item.q}
                </span>
                <ChevronDownIcon
                  size={22}
                  className={`shrink-0 text-olive transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              className="px-5 pb-5 text-[16px] leading-relaxed text-muted"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
