export interface CelebrationMetadata {
  proposal_id?: string;
  opportunity_id?: string;
  cs_opportunity_id?: string;
  contract_id?: string;
  acceptor_name?: string;
  seller_name?: string;
  value?: number;
  account_name?: string;
  role?: string;
  primary_color?: string;
  show_celebration?: boolean;
}

export interface CelebrationNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  metadata: CelebrationMetadata;
}
