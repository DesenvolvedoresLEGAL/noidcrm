import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { DiagnosticScores } from "@/types/diagnostic";
import { diagnosticQuestions } from "@/data/diagnosticQuestions";

interface DiagnosticRadarChartProps {
  scores: DiagnosticScores;
}

export function DiagnosticRadarChart({ scores }: DiagnosticRadarChartProps) {
  const data = useMemo(() => {
    return diagnosticQuestions.map(q => {
      const maxPoints = q.weight;
      const actualPoints = scores[q.areaKey as keyof DiagnosticScores] || 0;
      const percentage = Math.round((actualPoints / maxPoints) * 100);
      
      return {
        area: q.area,
        value: percentage,
        fullMark: 100,
      };
    });
  }, [scores]);

  return (
    <div className="w-full h-[280px] md:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="hsl(var(--border))" 
            strokeOpacity={0.3}
          />
          <PolarAngleAxis
            dataKey="area"
            tick={{ 
              fill: "hsl(var(--muted-foreground))", 
              fontSize: 10,
              fontWeight: 500 
            }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
