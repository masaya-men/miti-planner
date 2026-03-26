import { useState, useCallback } from 'react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { Preloader } from './Preloader';
import { CustomCursor } from './CustomCursor';
import { ScrollProgress } from './ScrollProgress';
import { HeroSection } from './HeroSection';
import { MitiSection } from './MitiSection';
import { FeaturesSection } from './FeaturesSection';
import { HousingSection } from './HousingSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';
import { ParticleBackground } from '../ParticleBackground';

export function LandingPage() {
  const [preloaderDone, setPreloaderDone] = useState(
    () => !!sessionStorage.getItem('lopo-visited')
  );

  useSmoothScroll();

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white">
      <CustomCursor />
      <ScrollProgress />
      <ParticleBackground />
      {!preloaderDone && <Preloader onComplete={handlePreloaderComplete} />}
      <main className="relative z-10">
        <HeroSection />
        <MitiSection />
        <FeaturesSection />
        <HousingSection />
        <CTASection />
        <LandingFooter />
      </main>
    </div>
  );
}
