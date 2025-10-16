import { Proposal } from './types';

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'prop-1',
    opportunity_id: '2',
    status: 'sent',
    pdf_url: '/proposals/prop-1.pdf',
    created_at: new Date().toISOString(),
  },
];

export async function sendProposal(id: string): Promise<Proposal> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const proposal = MOCK_PROPOSALS.find(p => p.id === id);
  if (!proposal) throw new Error('Proposal not found');
  
  proposal.status = 'sent';
  return proposal;
}

export async function getProposal(id: string): Promise<Proposal | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_PROPOSALS.find(p => p.id === id) || null;
}
