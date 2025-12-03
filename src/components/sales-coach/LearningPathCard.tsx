import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Play, Clock, ExternalLink } from 'lucide-react';

interface VideoRecommendation {
  id: string;
  video_library: {
    id: string;
    title: string;
    url: string;
    duration_sec: number;
    level: string;
  };
}

interface LearningPathCardProps {
  videos: VideoRecommendation[];
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

function getLevelColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'básico':
      return 'bg-green-500/10 text-green-500';
    case 'intermediário':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'avançado':
      return 'bg-red-500/10 text-red-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function LearningPathCard({ videos }: LearningPathCardProps) {
  if (videos.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Trilha de Aprendizado
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
          Complete treinos para receber recomendações de vídeos personalizadas
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Trilha de Aprendizado
          <Badge variant="secondary" className="ml-auto text-xs">
            {videos.length} vídeos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {videos.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{rec.video_library?.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(rec.video_library?.duration_sec || 0)}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getLevelColor(rec.video_library?.level)}`}
                  >
                    {rec.video_library?.level}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => window.open(rec.video_library?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
