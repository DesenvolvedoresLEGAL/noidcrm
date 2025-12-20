import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { 
  CommunityHero, 
  CommunityNavTabs, 
  CommunityTab,
  SuggestionList,
  DiscussionList,
  AnnouncementList,
  CaseList,
  CommunityBadges,
  CommunityGuidelines,
  CommunityCTA,
} from "@/components/community";

export default function Community() {
  const [activeTab, setActiveTab] = useState<CommunityTab>("suggestions");

  const handleCreateSuggestion = () => {
    setActiveTab("suggestions");
    // The dialog will be triggered by the button in SuggestionList
  };

  const handleStartDiscussion = () => {
    setActiveTab("discussions");
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "suggestions":
        return <SuggestionList />;
      case "discussions":
        return <DiscussionList />;
      case "announcements":
        return <AnnouncementList />;
      case "cases":
        return <CaseList />;
      case "badges":
        return <CommunityBadges />;
      default:
        return <SuggestionList />;
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Comunidade | NOID RevenueOS</title>
        <meta 
          name="description" 
          content="Construa o futuro do NOID RevenueOS com a comunidade. Sugira melhorias, participe de discussões e compartilhe aprendizados." 
        />
      </Helmet>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <CommunityHero />

        {/* Navigation Tabs */}
        <CommunityNavTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="mb-8">
          {renderTabContent()}
        </div>

        {/* Guidelines */}
        <div className="mb-8">
          <CommunityGuidelines />
        </div>

        {/* CTA */}
        <CommunityCTA 
          onCreateSuggestion={handleCreateSuggestion}
          onStartDiscussion={handleStartDiscussion}
        />
      </div>
    </Layout>
  );
}
