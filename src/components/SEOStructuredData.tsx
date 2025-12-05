import { Helmet } from 'react-helmet-async';

interface OrganizationSchemaProps {
  name: string;
  url: string;
  logo?: string;
  description?: string;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

interface SoftwareAppSchemaProps {
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
}

/**
 * Organization Schema for company pages
 */
export function OrganizationSchema({ name, url, logo, description }: OrganizationSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    ...(logo && { logo }),
    ...(description && { description }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

/**
 * Breadcrumb Schema for navigation
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

/**
 * SoftwareApplication Schema for the CRM
 */
export function SoftwareAppSchema({ name, description, applicationCategory, operatingSystem, offers }: SoftwareAppSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory,
    operatingSystem,
    ...(offers && {
      offers: {
        '@type': 'Offer',
        ...offers,
      },
    }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

/**
 * Default CRM structured data
 */
export function CRMStructuredData() {
  return (
    <>
      <OrganizationSchema
        name="NOID CRM"
        url="https://noidcrm.com"
        description="AI Revenue Operating System - CRM inteligente para equipes de vendas"
      />
      <SoftwareAppSchema
        name="NOID CRM"
        description="Sistema de CRM com inteligência artificial para automação de vendas, gestão de oportunidades e análise preditiva."
        applicationCategory="BusinessApplication"
        operatingSystem="Web Browser"
        offers={{
          price: '199',
          priceCurrency: 'BRL',
        }}
      />
    </>
  );
}
