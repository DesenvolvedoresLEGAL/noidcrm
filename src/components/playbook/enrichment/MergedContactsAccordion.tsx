import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { listMergedContacts } from "@/services/enrichment/apolloService";

interface Props {
  prospectId: string;
}

export function MergedContactsAccordion({ prospectId }: Props) {
  const { data: merged = [] } = useQuery({
    queryKey: ["merged-contacts", prospectId],
    queryFn: () => listMergedContacts(prospectId),
    enabled: !!prospectId,
  });

  if (merged.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="border rounded-md">
      <AccordionItem value="merged" className="border-b-0">
        <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
          🧹 {merged.length} duplicado{merged.length > 1 ? "s" : ""} resolvido{merged.length > 1 ? "s" : ""}
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-1.5">
          {merged.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs text-muted-foreground border-l-2 border-muted pl-2 py-1">
              <div className="truncate">
                <span className="font-medium text-foreground">{c.full_name ?? c.email ?? "—"}</span>
                {c.role_title && <span className="ml-1">· {c.role_title}</span>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.confidence_score != null && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {c.confidence_score}
                  </Badge>
                )}
                <span className="text-[10px]">{c.provider}</span>
              </div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
