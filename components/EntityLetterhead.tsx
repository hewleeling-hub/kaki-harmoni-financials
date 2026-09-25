import { businessConfig, entitySubline } from "@/config/business";

/**
 * The company's masthead, for any document that goes outside the business.
 *
 * Kaki Harmoni is the brand; AQUAHARMONI SDN. BHD. is the company that owes
 * and is owed the money, so the documents lead with the company and carry the
 * SSM number under it. Kept in one component so every document says the same
 * thing, and a new one can't be written that forgets half of it.
 */
export function EntityLetterhead() {
  return (
    <div>
      <p className="font-serif text-2xl font-semibold">{businessConfig.legalName}</p>
      <p className="text-xs text-neutral-500">{entitySubline()}</p>
      <p className="mt-1 whitespace-pre-line text-xs text-neutral-500">
        {businessConfig.address.lines.join("\n")}
      </p>
    </div>
  );
}
