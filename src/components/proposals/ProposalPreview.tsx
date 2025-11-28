import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { replaceVariables, VariableContext, hasVariables } from '@/lib/proposalVariables';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface ProposalPreviewProps {
  proposalId?: string;
  opportunityId?: string;
  content: {
    introduction?: string;
    terms?: string;
    notes?: string;
  };
}

export function ProposalPreview({ proposalId, opportunityId, content }: ProposalPreviewProps) {
  const { user } = useCurrentUser();

  // Load context data for variable replacement
  const { data: context } = useQuery({
    queryKey: ['proposal-context', proposalId, opportunityId],
    queryFn: async () => {
      const ctx: VariableContext = {};

      // Load organization
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (orgId) {
        const { data: organization } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (organization) {
          ctx.organization = {
            name: organization.name,
            cnpj: organization.cnpj,
            legal_name: organization.legal_name,
            address_street: organization.address_street,
            address_number: organization.address_number,
            address_complement: organization.address_complement,
            address_city: organization.address_city,
            address_state: organization.address_state,
            address_zip: organization.address_zip,
            phone: organization.phone,
            email: organization.email,
            website: organization.website,
          };
        }
      }

      // Load proposal data
      if (proposalId) {
        const { data: proposal } = await supabase
          .from('proposals')
          .select('*, opportunity:opportunities(*)')
          .eq('id', proposalId)
          .single();

        if (proposal) {
          ctx.proposal = {
            title: proposal.title,
            id: proposal.id,
            version: proposal.version,
            created_at: proposal.created_at,
            expires_at: proposal.expires_at,
            total_amount: proposal.total_amount,
            subtotal: proposal.subtotal,
          };

          // Load account and contact from opportunity
          if (proposal.opportunity) {
            const opp = proposal.opportunity as any;
            
            if (opp.account_id) {
              const { data: account } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', opp.account_id)
                .single();
              
              if (account) {
                ctx.account = account;
              }
            }

            if (opp.contact_id) {
              const { data: contact } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', opp.contact_id)
                .single();
              
              if (contact) {
                ctx.contact = contact;
              }
            }

            // Load owner
            if (opp.owner_user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', opp.owner_user_id)
                .single();
              
              if (profile) {
                ctx.owner = profile;
              }
            }
          }
        }
      } else if (opportunityId) {
        // Load opportunity data for new proposal
        const { data: opp } = await supabase
          .from('opportunities')
          .select('*')
          .eq('id', opportunityId)
          .single();

        if (opp) {
          if (opp.account_id) {
            const { data: account } = await supabase
              .from('accounts')
              .select('*')
              .eq('id', opp.account_id)
              .single();
            
            if (account) ctx.account = account;
          }

          if (opp.contact_id) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('*')
              .eq('id', opp.contact_id)
              .single();
            
            if (contact) ctx.contact = contact;
          }

          if (opp.owner_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', opp.owner_user_id)
              .single();
            
            if (profile) ctx.owner = profile;
          }
        }
      }

      return ctx;
    },
    enabled: !!(proposalId || opportunityId),
  });

  // Check if any content has variables
  const hasAnyVariables = 
    hasVariables(content.introduction || '') ||
    hasVariables(content.terms || '') ||
    hasVariables(content.notes || '');

  if (!hasAnyVariables) {
    return null; // Don't show preview if no variables
  }

  const processedContent = context ? {
    introduction: replaceVariables(content.introduction || '', context),
    terms: replaceVariables(content.terms || '', context),
    notes: replaceVariables(content.notes || '', context),
  } : content;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Preview com Variáveis
          </CardTitle>
          <Badge variant="secondary">Pré-visualização</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Veja como o texto ficará com as variáveis substituídas
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {processedContent.introduction && (
          <div>
            <h4 className="font-medium text-sm mb-2">Introdução</h4>
            <div 
              className="prose prose-sm max-w-none p-3 bg-background rounded-md border"
              dangerouslySetInnerHTML={{ __html: processedContent.introduction.replace(/\n/g, '<br />') }}
            />
          </div>
        )}
        
        {processedContent.terms && (
          <div>
            <h4 className="font-medium text-sm mb-2">Termos e Condições</h4>
            <div 
              className="prose prose-sm max-w-none p-3 bg-background rounded-md border"
              dangerouslySetInnerHTML={{ __html: processedContent.terms.replace(/\n/g, '<br />') }}
            />
          </div>
        )}
        
        {processedContent.notes && (
          <div>
            <h4 className="font-medium text-sm mb-2">Observações</h4>
            <div 
              className="prose prose-sm max-w-none p-3 bg-background rounded-md border"
              dangerouslySetInnerHTML={{ __html: processedContent.notes.replace(/\n/g, '<br />') }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
