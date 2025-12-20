import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, MessageSquare, Megaphone, Trophy, Award } from "lucide-react";

export type CommunityTab = 'suggestions' | 'discussions' | 'announcements' | 'cases' | 'badges';

interface CommunityNavTabsProps {
  activeTab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
}

export function CommunityNavTabs({ activeTab, onTabChange }: CommunityNavTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as CommunityTab)} className="w-full mb-6">
      <TabsList className="w-full justify-start h-12 bg-muted/50 p-1 gap-1 overflow-x-auto flex-nowrap">
        <TabsTrigger 
          value="suggestions" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Sugestões</span>
          <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">⭐</span>
        </TabsTrigger>
        <TabsTrigger 
          value="discussions" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Discussões</span>
        </TabsTrigger>
        <TabsTrigger 
          value="announcements" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Megaphone className="h-4 w-4" />
          <span className="hidden sm:inline">Anúncios</span>
        </TabsTrigger>
        <TabsTrigger 
          value="cases" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Trophy className="h-4 w-4" />
          <span className="hidden sm:inline">Cases</span>
        </TabsTrigger>
        <TabsTrigger 
          value="badges" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Award className="h-4 w-4" />
          <span className="hidden sm:inline">Badges</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
