import Features from '@/components/Features';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Navbar from '@/components/Navbar';
import { CtaBand, SecurityBand } from '@/components/SecurityBand';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <SecurityBand />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
