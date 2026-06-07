import { LandingNavbar } from "./LandingNavbar";
import { LandingHero } from "./LandingHero";
import { CoursesSection } from "./CoursesSection";
import { LandingFeatures } from "./LandingFeatures";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingStats } from "./LandingStats";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <>
      <LandingNavbar />
      <main>
        <LandingHero />
        <CoursesSection />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingStats />
      </main>
      <LandingFooter />
    </>
  );
}
