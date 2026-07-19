# Data Model

## chairs
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | owner-scoping at lock-down |
| label | text | "Chair 1"…"Chair 4" |
| status | text | enum: free / running / resting |
| current_session_id | uuid nullable | FK to sessions (soft) |
| created_at | timestamptz | |

## products
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| category | text | spa / coffee / food / retail |
| cost_price | numeric | |
| standalone_price | numeric | |
| bundle_allocation | numeric | 28 for spa, 12 for coffee, 0 for extras |
| is_active | boolean | |

## sessions
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| chair_id | uuid | |
| started_at | timestamptz | |
| spa_ends_at | timestamptz | started_at + 15 min |
| rest_ends_at | timestamptz | started_at + 45 min |
| status | text | running / resting / completed |

## sales
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid | |
| sale_date | date | |
| payment_method | text | cash / ewallet / bank_transfer |
| total_amount | numeric | |
| is_bundle | boolean | |

## sale_items
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sale_id | uuid | |
| product_id | uuid | |
| quantity | int | |
| unit_price | numeric | bundle_allocation or standalone_price |
| unit_cost | numeric | product cost_price snapshot |
| is_bundle_split | boolean | true for auto-split RM28/RM12 |

## expenses
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| expense_date | date | |
| vendor | text | |
| description | text | |
| amount | numeric | |
| category | text | supplies / cost_of_goods / maintenance / utilities / rent / other |
| payer | text | company / personal / petty_cash / staff_card |
| expense_type | text | expense / fixed_asset |
| is_settled | boolean | |
| receipt_url | text nullable | |
| ai_category | text | AI-suggested category |
| ai_category_source | text | e.g. "gpt-4o" |
| ai_category_confidence | numeric | 0–1 |
| ai_category_review_status | text | unreviewed / accepted / overridden |

## reimbursements
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| expense_id | uuid | |
| owed_to | text | "Owner (personal)" / staff name |
| amount | numeric | |
| is_settled | boolean | |
| settled_at | timestamptz nullable | |

## RLS
All tables: v1 permissive (select/all for everyone). Lock-down sprint replaces with `auth.uid() = user_id`.
