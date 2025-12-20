import { DocsCategoryCard } from './DocsCategoryCard';
import { DocsCategory } from '@/hooks/useDocsArticles';

interface DocsCategoryGridProps {
  categories: DocsCategory[];
  onCategoryClick: (category: string) => void;
}

// Define order for categories
const categoryOrder = [
  'getting-started',
  'configuration',
  'sales-revenue',
  'artificial-intelligence',
  'operations',
  'security',
  'integrations',
  'faq',
];

export function DocsCategoryGrid({ categories, onCategoryClick }: DocsCategoryGridProps) {
  // Sort categories by defined order
  const sortedCategories = [...categories].sort((a, b) => {
    const indexA = categoryOrder.indexOf(a.id);
    const indexB = categoryOrder.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <section className="py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-8">
          Explore por categoria
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sortedCategories.map((category, index) => (
            <DocsCategoryCard
              key={category.id}
              name={category.name}
              description={category.description}
              icon={category.icon}
              articleCount={category.articleCount}
              onClick={() => onCategoryClick(category.id)}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
