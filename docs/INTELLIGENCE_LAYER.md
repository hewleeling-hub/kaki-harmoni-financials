# Intelligence Layer

## Messy Inputs
- Vendor name typed freehand ("eco clean", "EcoClean Sdn Bhd", "eco c")
- Expense description is optional and inconsistent
- Staff may not know the correct category

## Auto-Structuring (v1 rule-based, later AI)
```json
{
  "input": { "vendor": "Eco Clean Supply", "description": "Towels and disinfectant" },
  "structured": {
    "ai_category": "supplies",
    "ai_category_source": "keyword-match-v1",
    "ai_category_confidence": 0.85,
    "ai_category_review_status": "unreviewed"
  }
}
```

## Events to Track
- Session started (chair, time-of-day, day-of-week)
- Session completed (duration matches expected?)
- Expense created (payer, category, amount)
- Reimbursement settled
- Chair idle gap > 30 min during open hours

## Scoring Rules (v1 rule-based)
| Signal | Rule |
|---|---|
| Chair occupancy % | sessions × 45 min ÷ 600 min operating window |
| Product margin | (unit_price − unit_cost) ÷ unit_price |
| Cashflow health | net > 0 = green, net < −RM200 = red |
| Reimbursement age | unsettled > 7 days → highlight |

## What Gets Ranked / Surfaced
- Lowest-margin product (daily)
- Emptiest chair by hour (weekly)
- Largest unsettled reimbursement

## v1 vs Later
- **v1:** keyword-based expense category suggestion, rule-based margin and occupancy scores
- **Later:** LLM expense categorisation from receipt photo, natural-language daily summary ("You had your best Tuesday — 18 sessions, 82% occupancy"), anomaly alerts (session count drop vs same weekday)
