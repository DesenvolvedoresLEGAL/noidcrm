import { Helmet } from 'react-helmet-async';
import {
  LandingHeader,
  HeroSection,
  ValuePillarsSection,
  FeaturesShowcase,
  ComparisonTable,
  PricingSection,
  SocialProofSection,
  FAQSection,
  LeadCaptureForm,
  FinalCTASection,
  LandingFooter,
} from '@/components/landing';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>NOID RevenueOS - O Primeiro CRM AI-First do Brasil | Reduza 70% do Trabalho Manual</title>
        <meta name="description" content="Sistema operacional de receita com IA que pensa, analisa e age junto com seu time de vendas. Forecast inteligente, pipeline vivo, scoring preditivo, roleplay com IA e mais. 30 dias grátis!" />
        <meta name="keywords" content="RevenueOS, CRM IA, CRM AI-First, automação vendas, forecast inteligente, pipeline vendas, scoring leads, roleplay vendas, coach IA, Brasil" />
        <link rel="canonical" href="https://noidcrm.com" />
        
        {/* Open Graph */}
        <meta property="og:title" content="NOID RevenueOS - O Primeiro CRM AI-First do Brasil" />
        <meta property="og:description" content="Reduza 70% do trabalho manual do seu time de vendas com IA que decide, prioriza e age no momento certo. Forecast inteligente, pipeline vivo, scoring preditivo." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://noidcrm.com" />
        <meta property="og:site_name" content="NOID RevenueOS" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NOID RevenueOS - CRM AI-First" />
        <meta name="twitter:description" content="Sistema operacional de receita com IA. Reduza 70% do trabalho manual em vendas." />

        {/* AEO Optimization */}
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <LandingHeader />
        <main>
          <HeroSection />
          <ValuePillarsSection />
          <FeaturesShowcase />
          <ComparisonTable />
          <SocialProofSection />
          <PricingSection />
          <FAQSection />
          <LeadCaptureForm />
          <FinalCTASection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

export default Index;
