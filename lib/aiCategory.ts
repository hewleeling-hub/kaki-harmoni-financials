// Intelligence Layer v1 — rule-based expense categorisation (docs/INTELLIGENCE_LAYER.md).
// Keyword match on vendor + description. "AI" is additive: the core works without it.
// Later this is swapped for an LLM call; the shape of the output stays the same.

import { EXPENSE_CATEGORIES } from "./constants";

const RULES: { category: (typeof EXPENSE_CATEGORIES)[number]; keywords: string[] }[] = [
  {
    category: "cost_of_goods",
    keywords: ["coffee", "bean", "milk", "syrup", "tea", "stock", "ingredient"],
  },
  {
    category: "supplies",
    keywords: ["towel", "disinfect", "clean", "soap", "tissue", "glove", "supply", "supplies", "scrub"],
  },
  {
    category: "maintenance",
    keywords: ["repair", "fix", "service", "machine", "spare", "part", "hardware", "maintenance"],
  },
  {
    category: "utilities",
    keywords: ["electric", "water bill", "wifi", "internet", "utility", "tnb", "phone", "gas"],
  },
  {
    category: "rent",
    keywords: ["rent", "lease", "rental"],
  },
];

export type CategorySuggestion = {
  ai_category: string;
  ai_category_source: string;
  ai_category_confidence: number;
  ai_category_review_status: string;
};

export function suggestExpenseCategory(
  vendor: string,
  description?: string | null,
): CategorySuggestion {
  const hay = `${vendor} ${description ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    const hit = rule.keywords.find((k) => hay.includes(k));
    if (hit) {
      return {
        ai_category: rule.category,
        ai_category_source: "keyword-match-v1",
        ai_category_confidence: 0.85,
        ai_category_review_status: "unreviewed",
      };
    }
  }
  return {
    ai_category: "other",
    ai_category_source: "keyword-match-v1",
    ai_category_confidence: 0.3,
    ai_category_review_status: "unreviewed",
  };
}
