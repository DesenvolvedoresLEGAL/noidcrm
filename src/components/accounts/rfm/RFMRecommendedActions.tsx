import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RFM_SEGMENTS, RFM_SEGMENT_LABEL, type RFMSegment } from '@/services/crm/account-rfm';

interface Props {
  actions: Record<RFMSegment, string> | undefined;
}

export function RFMRecommendedActions({ actions }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ações recomendadas por segmento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {RFM_SEGMENTS.map((seg) => (
          <div key={seg} className="border rounded-md p-3 space-y-1">
            <div className="font-medium text-sm">{RFM_SEGMENT_LABEL[seg]}</div>
            <div className="text-xs text-muted-foreground">{actions?.[seg] ?? '—'}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
