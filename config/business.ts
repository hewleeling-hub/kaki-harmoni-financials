/**
 * Kaki Harmoni — central business configuration.
 *
 * Single source of truth for the customer-facing site: prices, promotions,
 * opening hours, address, contact details and FAQ copy. Update values HERE —
 * do not hard-code them inside components.
 *
 * ⚠️ VERIFY BEFORE LAUNCH: values marked `// TODO(verify)` are taken from the
 * redesign brief and have not yet been confirmed against the live business.
 * The internal bookkeeping app currently only models a RM40 spa+coffee bundle,
 * so the customer prices below (RM48 / RM35 / RM38) are new and unconfirmed.
 */

export const businessConfig = {
  name: "Kaki Harmoni",
  tagline: "Relax • Refresh • Reconnect",

  // Contact — digits only for wa.me / tel: links are derived below.
  phone: "+60192871799", // TODO(verify)
  whatsapp: "+60192871799", // TODO(verify)

  address: {
    // TODO(verify) — confirm the exact formatted address before launch.
    name: "Kaki Harmoni",
    lines: [
      "Clubhouse, Desa Cindaimas Condominium",
      "Jalan Sekutu, off Jalan Klang Lama",
      "58200 Kuala Lumpur",
    ],
    // Used for the Google Maps embed + directions link.
    mapQuery: "Desa Cindaimas Condominium, Jalan Klang Lama, 58200 Kuala Lumpur",
  },

  openingHours: {
    label: "Open Daily",
    display: "10:00am – 8:00pm",
    // 24h numbers drive the live Open / Closing soon / Closed status.
    openHour: 10,
    closeHour: 20,
    timezone: "Asia/Kuala_Lumpur",
  },

  // Session prices in RM. TODO(verify) — new customer pricing.
  pricing: {
    single: 48,
    earlyBird: 35,
    resident: 38,
    secondSessionDiscountPct: 50,
  },

  // Session passes. TODO(verify) — confirm before selling.
  passes: [
    {
      id: "pass-5",
      name: "5-Session Pass",
      price: 220,
      validity: "Valid for 3 months",
      savings: 20,
    },
    {
      id: "pass-10",
      name: "10-Session Pass",
      price: 420,
      validity: "Valid for 6 months",
      savings: 60,
    },
  ],

  // Placeholder social links — replace or remove when confirmed.
  social: {
    instagram: "", // TODO(verify)
    facebook: "", // TODO(verify)
  },
} as const;

/** Session options shown on Home + Sessions pages (drawn from pricing above). */
export const sessionOptions = [
  {
    id: "single",
    name: "Single Session",
    price: businessConfig.pricing.single,
    unit: "per session",
    description: "Available during normal opening hours. Walk in anytime.",
    badge: null as string | null,
  },
  {
    id: "early-bird",
    name: "Early Bird",
    price: businessConfig.pricing.earlyBird,
    unit: "per session",
    description: "Available weekdays from 9:30am to 11:30am.",
    badge: "Best weekday value",
  },
  {
    id: "resident",
    name: "Resident Price",
    price: businessConfig.pricing.resident,
    unit: "per session",
    description: "Available with proof of residence.",
    badge: null,
  },
] as const;

/** Promotions surfaced across the site. */
export const promotions = [
  {
    id: "second-session",
    title: "Second session, same day",
    highlight: `${businessConfig.pricing.secondSessionDiscountPct}% off`,
    description:
      "Enjoy a second warm soak on the same day at half price. Just let our team know.",
    terms: "One discounted second session per person, per day. Valid in-store only.",
  },
] as const;

/** “Good to know before you visit” — no medical claims. */
export const goodToKnow = [
  "Wear comfortable clothing.",
  "Sessions last approximately 15 minutes.",
  "Please arrive five minutes early.",
  "Let our team know if you need any assistance.",
  "Children should be supervised.",
  "Some health conditions may need a word with your doctor before soaking.",
] as const;

/** FAQ content — editable here, rendered by the accordion. */
export const faqs = [
  {
    q: "How long is each session?",
    a: "Each warm leg soak lasts about 15 minutes — a simple break that fits into your day.",
  },
  {
    q: "Do I need to make an appointment?",
    a: "No appointment is needed. You're welcome to book ahead to be sure of a chair, or simply walk in.",
  },
  {
    q: "Can I walk in?",
    a: "Yes. Walk in anytime during opening hours and we'll get you settled.",
  },
  {
    q: "What should I wear?",
    a: "Comfortable, everyday clothing is perfect. You'll simply roll up for the soak.",
  },
  {
    q: "Can I come with a friend?",
    a: "Of course — bring a friend or a family member. It's a lovely place to sit together and chat.",
  },
  {
    q: "Is the water cleaned between sessions?",
    a: "Yes. Fresh water is prepared for every guest and the tubs are cleaned between sessions.",
  },
  {
    q: "Can older adults use the service?",
    a: "Yes. Our space is designed to be gentle and comfortable. Let our team know if you'd like a hand getting settled.",
  },
  {
    q: "What should I do if I have a medical condition?",
    a: "If you have a health condition, we suggest a quick word with your doctor beforehand. Our team is happy to help you feel comfortable.",
  },
  {
    q: "Is massage included?",
    a: "No — Kaki Harmoni is a warm leg soak with a comfortable place to rest, not a massage service.",
  },
  {
    q: "Are drinks included?",
    a: "A cup of coffee, tea or another available drink is part of your relaxing visit.",
  },
] as const;

/** The four-step visit journey. */
export const visitSteps = [
  {
    number: 1,
    title: "Check in",
    icon: "users",
    short: "We'll welcome you and help you get comfortable.",
    long: "We'll welcome you, confirm your session and help you get comfortable.",
  },
  {
    number: 2,
    title: "Choose your drink",
    icon: "coffee",
    short: "Pick a coffee, tea or another drink.",
    long: "Enjoy a cup of coffee, tea or another available drink.",
  },
  {
    number: 3,
    title: "Relax and soak",
    icon: "heart",
    short: "Settle in for a warm 15-minute soak.",
    long: "Sit comfortably while your legs enjoy a warm 15-minute soak.",
  },
  {
    number: 4,
    title: "Refresh and reconnect",
    icon: "message",
    short: "Unwind, chat or enjoy some quiet time.",
    long: "Take a moment to unwind, chat or enjoy some quiet time.",
  },
] as const;

/* --------------------------- derived helpers --------------------------- */

const waDigits = businessConfig.whatsapp.replace(/[^0-9]/g, "");

/** Build a wa.me link, optionally with a pre-filled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${waDigits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** tel: link for the Call button. */
export const telLink = `tel:${businessConfig.phone.replace(/\s/g, "")}`;

/** Google Maps embed src (no API key required). */
export const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(
  businessConfig.address.mapQuery,
)}&output=embed`;

/** Google Maps directions link. */
export const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  businessConfig.address.mapQuery,
)}`;

/** Pre-filled WhatsApp text for a booking request (WhatsApp-first flow). */
export function bookingWhatsappText(input: {
  sessionName?: string;
  date?: string;
  time?: string;
  guests?: number;
  name?: string;
  note?: string;
}): string {
  const lines = [
    "Hi Kaki Harmoni, I'd like to book a session.",
    input.sessionName ? `• Session: ${input.sessionName}` : null,
    input.date ? `• Date: ${input.date}` : null,
    input.time ? `• Time: ${input.time}` : null,
    input.guests ? `• Guests: ${input.guests}` : null,
    input.name ? `• Name: ${input.name}` : null,
    input.note ? `• Note: ${input.note}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export type SessionOption = (typeof sessionOptions)[number];
export type Promotion = (typeof promotions)[number];
