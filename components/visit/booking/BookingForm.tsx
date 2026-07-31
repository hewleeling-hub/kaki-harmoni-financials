"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/visit/ui/primitives";
import { Lotti } from "@/components/visit/ui/Lotti";
import {
  MessageIcon,
  CalendarIcon,
  NavigationIcon,
  CheckIcon,
  ArrowRightIcon,
} from "@/components/visit/ui/icons";
import {
  sessionOptions,
  bookingWhatsappText,
  whatsappLink,
  directionsLink,
} from "@/config/business";

type View = "form" | "review" | "done";

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 10; h < 20; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 19) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

/** Build & download a simple calendar (.ics) file for the requested slot. */
function downloadIcs(opts: {
  title: string;
  date: string;
  time: string;
}) {
  const [h, m] = opts.time.split(":").map(Number);
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + 15 * 60_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate(),
    ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(
      d.getMinutes(),
    ).padStart(2, "0")}00`;
  void h;
  void m;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kaki Harmoni//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${opts.title}`,
    "LOCATION:Kaki Harmoni, Kuala Lumpur",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaki-harmoni-session.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export function BookingForm({
  initialSession,
  passParam,
}: {
  initialSession?: string;
  passParam?: string;
}) {
  const [view, setView] = useState<View>("form");
  const [sessionId, setSessionId] = useState(
    sessionOptions.find((s) => s.id === initialSession)?.id ?? sessionOptions[0].id,
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(1);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState(passParam ? `Pass enquiry: ${passParam}` : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const session = sessionOptions.find((s) => s.id === sessionId)!;

  const waText = useMemo(
    () =>
      bookingWhatsappText({
        sessionName: session.name,
        date: formatDate(date),
        time: formatTime(time),
        guests,
        name,
        note,
      }),
    [session.name, date, time, guests, name, note],
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Please enter your full name.";
    if (!/^[0-9+\-\s]{7,}$/.test(mobile.trim()))
      e.mobile = "Please enter a valid mobile number.";
    if (!date) e.date = "Please choose a date.";
    else if (date < todayISO()) e.date = "Please choose today or a later date.";
    if (!time) e.time = "Please choose a time.";
    if (guests < 1) e.guests = "At least one guest is needed.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleReview() {
    if (validate()) {
      setView("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  /* --------------------------- confirmation --------------------------- */
  if (view === "done") {
    return (
      <div className="mt-8">
        <Card className="text-center">
          <div className="mx-auto w-28">
            <Lotti variant="celebrating" className="h-auto w-full" />
          </div>
          <h2 className="mt-4 text-[26px] text-olive-dark">
            Your request is on its way
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[17px] leading-relaxed text-brown">
            Your relaxing break is booked. We look forward to welcoming you.
            We&apos;ll confirm your session on WhatsApp shortly.
          </p>

          <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-[18px] border border-line bg-cream/60 p-5 text-left">
            <SummaryRow label="Session" value={session.name} />
            <SummaryRow label="Date" value={formatDate(date)} />
            <SummaryRow label="Time" value={formatTime(time)} />
            <SummaryRow label="Guests" value={String(guests)} />
            <SummaryRow label="Name" value={name} />
            <SummaryRow label="Location" value="Kaki Harmoni, Kuala Lumpur" />
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={() =>
                downloadIcs({ title: `Kaki Harmoni — ${session.name}`, date, time })
              }
              variant="secondary"
              icon={<CalendarIcon size={20} />}
            >
              Add to Calendar
            </Button>
            <Button href={directionsLink} variant="secondary" icon={<NavigationIcon size={20} />}>
              Get Directions
            </Button>
            <Button href={whatsappLink(waText)} icon={<MessageIcon size={20} />}>
              WhatsApp Us
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setView("form")}
            className="mt-6 text-[15px] font-semibold text-olive underline underline-offset-4"
          >
            Book another session
          </button>
        </Card>
      </div>
    );
  }

  /* ------------------------------ review ------------------------------ */
  if (view === "review") {
    return (
      <div className="mt-8">
        <Card>
          <h2 className="text-[22px] text-olive-dark">Review your booking</h2>
          <p className="mt-1 text-[16px] text-muted">
            Please check the details, then send your request on WhatsApp.
          </p>
          <dl className="mt-5 space-y-2 rounded-[18px] border border-line bg-cream/60 p-5">
            <SummaryRow label="Session" value={session.name} />
            <SummaryRow label="Date" value={formatDate(date)} />
            <SummaryRow label="Time" value={formatTime(time)} />
            <SummaryRow label="Guests" value={String(guests)} />
            <SummaryRow label="Name" value={name} />
            <SummaryRow label="Mobile" value={mobile} />
            {note && <SummaryRow label="Note" value={note} />}
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              href={whatsappLink(waText)}
              size="lg"
              icon={<MessageIcon size={22} />}
              onClick={() => setView("done")}
              full
            >
              Send request on WhatsApp
            </Button>
            <Button
              onClick={() => setView("form")}
              variant="secondary"
              size="lg"
            >
              Edit details
            </Button>
          </div>
          <p className="mt-3 text-[14px] text-muted">
            This opens WhatsApp with your details ready to send. No account needed.
          </p>
        </Card>
      </div>
    );
  }

  /* ------------------------------- form ------------------------------- */
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleReview();
        }}
        noValidate
      >
        {/* Session type */}
        <fieldset>
          <legend className="text-[17px] font-semibold text-olive-dark">
            1. Choose your session
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {sessionOptions.map((opt) => {
              const active = opt.id === sessionId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSessionId(opt.id)}
                  aria-pressed={active}
                  className={`rounded-[18px] border p-4 text-left transition ${
                    active
                      ? "border-olive bg-olive/10 ring-2 ring-olive/50"
                      : "border-line bg-ivory hover:border-olive/50"
                  }`}
                >
                  <span className="block text-[16px] font-semibold text-olive-dark">
                    {opt.name}
                  </span>
                  <span className="mt-1 block text-[15px] text-muted">
                    RM{opt.price}
                  </span>
                  {active && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-olive">
                      <CheckIcon size={16} /> Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Date & time */}
        <fieldset>
          <legend className="text-[17px] font-semibold text-olive-dark">
            2. Pick a date and time
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={errors.date} htmlFor="bk-date">
              <input
                id="bk-date"
                type="date"
                value={date}
                min={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Time" error={errors.time} htmlFor="bk-time">
              <select
                id="bk-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input"
              >
                <option value="">Select a time</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Your details */}
        <fieldset>
          <legend className="text-[17px] font-semibold text-olive-dark">
            3. Your details
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name} htmlFor="bk-name">
              <input
                id="bk-name"
                type="text"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Aunty Tan"
              />
            </Field>
            <Field label="Mobile number" error={errors.mobile} htmlFor="bk-mobile">
              <input
                id="bk-mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="input"
                placeholder="e.g. 012-345 6789"
              />
            </Field>
            <Field label="Number of guests" error={errors.guests} htmlFor="bk-guests">
              <select
                id="bk-guests"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="input"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note (optional)" htmlFor="bk-note">
              <input
                id="bk-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
                placeholder="Anything we should know?"
              />
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" iconRight={<ArrowRightIcon size={22} />}>
            Review booking
          </Button>
          <Button
            href={whatsappLink("Hi Kaki Harmoni, I'd like to book a session.")}
            variant="secondary"
            size="lg"
            icon={<MessageIcon size={22} />}
          >
            Book on WhatsApp instead
          </Button>
        </div>
      </form>

      {/* Live summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="bg-cream/60">
          <h2 className="text-[18px] text-olive-dark">Your booking</h2>
          <dl className="mt-3 space-y-2">
            <SummaryRow label="Session" value={session.name} />
            <SummaryRow label="Price" value={`RM${session.price}`} />
            <SummaryRow label="Date" value={date ? formatDate(date) : "—"} />
            <SummaryRow label="Time" value={time ? formatTime(time) : "—"} />
            <SummaryRow label="Guests" value={String(guests)} />
          </dl>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            We&apos;ll confirm your session on WhatsApp. You can always walk in
            during opening hours too.
          </p>
        </Card>
      </aside>

      <style>{`
        .visit-scope .input {
          width: 100%;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid var(--color-line);
          background: var(--color-ivory);
          padding: 0 14px;
          font-size: 16px;
          color: var(--color-ink);
        }
        .visit-scope .input:focus-visible {
          outline: 3px solid var(--color-olive);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[15px] font-medium text-olive-dark">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-[14px] font-medium text-[#a8442f]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className="text-right text-[15px] font-semibold text-olive-dark">{value}</dd>
    </div>
  );
}
