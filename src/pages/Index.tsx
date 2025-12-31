import { Helmet } from 'react-helmet-async';
import {
  LandingHeader,
  HeroSection,
  InvisibleFlawsSection,
  WhyToolsFailSection,
  WhatIsNoidSection,
  InverseApproachSection,
  LeadCaptureForm,
  AIGovernanceSection,
  NotForEveryoneSection,
  ComparisonTable,
  SocialProofSection,
  PricingSection,
  SetupSection,
  FinalCTASection,
  FAQSection,
  LandingFooter,
} from '@/components/landing';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>NOID RevenueOS - Descubra Falhas Invisíveis na Sua Operação de Receita</title>
        <meta name="description" content="O NOID RevenueOS identifica, previne e corrige erros que fazem negócios estagnarem. Sistema operacional de receita com IA que decide, prioriza e protege seu pipeline." />
        <meta name="keywords" content="RevenueOS, CRM IA, falhas de vendas, vazamento de receita, automação vendas, forecast inteligente, pipeline vendas, scoring leads, Brasil" />
        <link rel="canonical" href="https://noidcrm.com" />
        
        {/* Open Graph */}
        <meta property="og:title" content="NOID RevenueOS - Descubra Falhas Invisíveis na Sua Operação de Receita" />
        <meta property="og:description" content="A maioria das empresas não perde vendas por falta de leads. Perde por falhas invisíveis na operação de receita. Descubra onde sua receita está vazando." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://noidcrm.com" />
        <meta property="og:site_name" content="NOID RevenueOS" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NOID RevenueOS - Falhas Invisíveis de Receita" />
        <meta name="twitter:description" content="Sistema operacional de receita com IA que identifica e corrige erros antes que custem caro." />

        {/* AEO Optimization */}
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <LandingHeader />
        <main>
          <HeroSection />
          <InvisibleFlawsSection />
          <WhyToolsFailSection />
          <WhatIsNoidSection />
          <InverseApproachSection />
          <LeadCaptureForm />
          <AIGovernanceSection />
          <NotForEveryoneSection />
          <ComparisonTable />
          <SocialProofSection />
          <PricingSection />
          <SetupSection />
          <FinalCTASection />
          <FAQSection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

export default Index;
