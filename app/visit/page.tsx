import { Hero } from "@/components/visit/home/Hero";
import { BenefitStrip } from "@/components/visit/home/BenefitStrip";
import { HowItWorksPreview } from "@/components/visit/home/HowItWorksPreview";
import { PricingPreview } from "@/components/visit/home/PricingPreview";
import { CommunitySection } from "@/components/visit/home/CommunitySection";
import { FinalCTA } from "@/components/visit/home/FinalCTA";

export default function VisitHome() {
  return (
    <>
      <Hero />
      <BenefitStrip />
      <HowItWorksPreview />
      <PricingPreview />
      <CommunitySection />
      <FinalCTA />
    </>
  );
}
