import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES, ASSET_CATEGORIES } from "@/lib/constants";

// Expense categories + fixed-asset classes (deduped) — the model picks the one
// matching expense_type.
const ALL_CATEGORIES = Array.from(
  new Set<string>([...EXPENSE_CATEGORIES, ...ASSET_CATEGORIES]),
);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Later-stage AI feature (docs/AGENTIC_LAYER.md → "AI receipt OCR populating
// expense form"). Extracts structured expense fields from a receipt photo or
// PDF using Claude vision + structured outputs. The core expense flow works
// with this switched off — this only pre-fills the form for the user to review.

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // ~5MB of base64-decoded data

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vendor: { type: "string", description: "Merchant / shop name on the receipt" },
    amount: { type: "number", description: "Grand total paid, as a number" },
    expense_date: {
      type: "string",
      description: "Date on the receipt in YYYY-MM-DD format; empty string if not visible",
    },
    description: {
      type: "string",
      description: "Short summary of what was bought (a few words)",
    },
    expense_type: {
      type: "string",
      enum: ["expense", "fixed_asset"],
      description:
        "fixed_asset for durable equipment (spa machines, furniture, computers, printers); otherwise expense",
    },
    line_items: {
      type: "array",
      description:
        "Each individual line on the receipt. Empty array if the receipt has no itemised lines.",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "Item name/description" },
          quantity: { type: "number", description: "Quantity; 1 if not shown" },
          unit_price: { type: "number", description: "Price per unit; 0 if not shown" },
          amount: { type: "number", description: "Line total for this item" },
        },
        required: ["description", "quantity", "unit_price", "amount"],
        additionalProperties: false,
      },
    },
    category: {
      type: "string",
      enum: ALL_CATEGORIES,
      description:
        "If expense_type is fixed_asset, the asset class (kitchen_equipment, spa_machine, furniture_and_fittings, electrical_equipment, office_equipment, computer, printer). Otherwise the best-fit expense category (supplies, cost_of_goods, operating_expenses, maintenance, utilities, rent, equipment, marketing, wages, transport, petrol, toll, meals).",
    },
  },
  required: [
    "vendor",
    "amount",
    "expense_date",
    "description",
    "category",
    "expense_type",
    "line_items",
  ],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Receipt scanning is not configured. Add ANTHROPIC_API_KEY to the Vercel project env to enable it.",
        needs_key: true,
      },
      { status: 501 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.data || !body?.media_type) {
    return NextResponse.json(
      { error: "data (base64) and media_type are required" },
      { status: 400 },
    );
  }

  const mediaType: string = body.media_type;
  const data: string = body.data;
  const isPdf = mediaType === "application/pdf";
  const isImage = IMAGE_TYPES.includes(mediaType);
  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Upload a photo (PNG/JPEG/WebP) or a PDF." },
      { status: 400 },
    );
  }
  // Rough size guard (base64 is ~4/3 the byte size).
  if (data.length * 0.75 > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Please use one under 5MB." },
      { status: 413 },
    );
  }

  const client = new Anthropic();

  const fileBlock = isPdf
    ? ({
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data },
      })
    : ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data,
        },
      });

  try {
    const message = await client.messages.create({
      // Haiku 4.5: fast + low-cost, supports vision + structured outputs — the
      // right tier for high-volume receipt OCR. Swap to claude-opus-4-8 for
      // harder receipts if accuracy ever falls short.
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "This is a business expense receipt for a foot-spa café. Extract the vendor, grand total amount, date, a short description of what was purchased, the best-fit category, whether it is an expense or a fixed asset, and each individual line item (description, quantity, unit price, line amount). If a field is not visible, use a sensible default (empty string for date, 'other' for category, [] for line_items).",
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({ fields: parsed });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = String(e.message || "").toLowerCase();
      let friendly =
        "Couldn't read the receipt automatically — please enter the details below manually.";
      if (e.status === 401) {
        friendly =
          "Receipt scanning key is invalid. Check ANTHROPIC_API_KEY in the project settings.";
      } else if (msg.includes("credit balance") || msg.includes("billing")) {
        friendly =
          "Receipt scanning is paused — the Anthropic API has no credit. Top up credit in the Anthropic console to re-enable it. Enter the details manually for now.";
      } else if (e.status === 429) {
        friendly =
          "Receipt scanning is busy right now — try again in a moment, or enter the details manually.";
      }
      // needs_key=true keeps the form's friendly "enter manually" path (no red error toast).
      return NextResponse.json({ error: friendly, needs_key: true }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Could not read the receipt. Enter the details manually.", needs_key: true },
      { status: 500 },
    );
  }
}
