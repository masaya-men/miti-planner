import { useState, useCallback, useEffect } from 'react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Preloader } from './Preloader';
import { CustomCursor } from './CustomCursor';
import { ScrollProgress } from './ScrollProgress';
import { LandingScene } from './LandingScene';
import { LangToggle } from './LangToggle';
import { HeroSection } from './HeroSection';
import { MitiSection } from './MitiSection';
import { FeaturesSection } from './FeaturesSection';
import { HousingSection } from './HousingSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  const [preloaderDone, setPreloaderDone] = useState(
    () => !!sessionStorage.getItem('lopo-visited')
  );

  useSmoothScroll();

  // トップページ用のタイトル設定
  useEffect(() => {
    document.title = 'LoPo — FFXIV Tool Portal';
  }, []);

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  // Preloader完了後にScrollTriggerのpin計算をリフレッシュ
  useEffect(() => {
    if (!preloaderDone) return;
    const timer = setTimeout(() => {
      ScrollTrigger.refresh(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [preloaderDone]);

  return (
    <div className="relative bg-black text-white overflow-x-hidden">
      <CustomCursor />
      <ScrollProgress />
      <LandingScene />
      <LangToggle />
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
