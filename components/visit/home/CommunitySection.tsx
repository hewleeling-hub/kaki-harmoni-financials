import { SectionHeading, PlaceholderImage } from "@/components/visit/ui/primitives";

export function CommunitySection() {
  return (
    <section className="grid items-center gap-8 py-10 lg:grid-cols-2">
      <div className="order-2 lg:order-1">
        <PlaceholderImage
          label="Shop interior — coffee, comfy chairs, plants & warm lighting"
          ratio="4 / 3"
        />
      </div>
      <div className="order-1 lg:order-2">
        <SectionHeading
          eyebrow="More than a soak"
          title="A comfortable place to slow down"
        />
        <p className="mt-4 text-[18px] leading-relaxed text-muted">
          Kaki Harmoni is a comfortable place to slow down, bring your parents,
          meet a friend or simply enjoy a quiet moment.
        </p>
        <ul className="mt-5 space-y-2 text-[16px] text-brown">
          {[
            "Freshly brewed coffee & tea",
            "Comfortable chairs to sink into",
            "A friendly space to chat",
            "Warm lighting and gentle plants",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-olive" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
