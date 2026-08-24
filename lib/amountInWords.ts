// Amount in words for petty cash vouchers — Malaysian convention:
// "Ringgit Malaysia Two Thousand Five Hundred And Eighty Only"
// with sen spelled out when there are any.

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

// 0–999 in words.
function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t} ${o}` : t;
  }
  const h = `${ONES[Math.floor(n / 100)]} Hundred`;
  const rest = n % 100;
  return rest ? `${h} And ${underThousand(rest)}` : h;
}

const SCALES: [number, string][] = [
  [1_000_000_000, "Billion"],
  [1_000_000, "Million"],
  [1_000, "Thousand"],
];

function wholeInWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  let left = n;
  for (const [value, name] of SCALES) {
    if (left >= value) {
      parts.push(`${underThousand(Math.floor(left / value))} ${name}`);
      left %= value;
    }
  }
  if (left > 0) {
    // "And" reads naturally before a trailing sub-hundred remainder
    // (Two Thousand And Eighty), but not before a fuller one.
    parts.push(parts.length && left < 100 ? `And ${underThousand(left)}` : underThousand(left));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Full voucher wording for a MYR amount, e.g.
 *   2580     → "Ringgit Malaysia Two Thousand Five Hundred And Eighty Only"
 *   86.7     → "Ringgit Malaysia Eighty Six And Sen Seventy Only"
 */
export function amountInWords(amount: number | string | null | undefined): string {
  const n = Math.abs(Number(amount ?? 0));
  // Round to sen first so 86.699 doesn't render as "…And Sen Seventy" off a
  // whole part of 86.69.
  const cents = Math.round(n * 100);
  const ringgit = Math.floor(cents / 100);
  const sen = cents % 100;

  const words = sen
    ? `${wholeInWords(ringgit)} And Sen ${wholeInWords(sen)}`
    : wholeInWords(ringgit);

  return `Ringgit Malaysia ${words} Only`;
}
