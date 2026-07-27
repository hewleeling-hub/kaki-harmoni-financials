import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

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
    category: {
      type: "string",
      enum: [...EXPENSE_CATEGORIES],
      description: "Best-fit expense category",
    },
    expense_type: {
      type: "string",
      enum: ["expense", "fixed_asset"],
      description: "fixed_asset for durable equipment (machines, furniture); otherwise expense",
    },
  },
  required: ["vendor", "amount", "expense_date", "description", "category", "expense_type"],
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
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "This is a business expense receipt for a foot-spa café. Extract the vendor, grand total amount, date, a short description of what was purchased, the best-fit category, and whether it is an expense or a fixed asset. If a field is not visible, use a sensible default (empty string for date, 'other' for category).",
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
      return NextResponse.json(
        { error: `Scan failed (${e.status}). ${e.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Could not read the receipt. Enter the details manually." },
      { status: 500 },
    );
  }
}
