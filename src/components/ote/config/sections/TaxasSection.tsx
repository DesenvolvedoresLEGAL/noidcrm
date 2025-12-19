import { useState, useEffect } from 'react';
import { ConversionRatesTab } from '../ConversionRatesTab';
import { useSalesConfig } from '@/hooks/useSalesConfig';

export function TaxasSection() {
  const { config } = useSalesConfig();
  
  const [formData, setFormData] = useState({
    outbound_call_to_lead: 0.30,
    outbound_lead_to_mql: 0.79,
    outbound_mql_to_proposal: 0.90,
    outbound_proposal_to_sale: 0.54,
    inbound_lead_to_mql: 0.87,
    inbound_mql_to_proposal: 0.90,
    inbound_proposal_to_sale: 0.58,
    referral_request_to_lead: 0.35,
    referral_lead_to_proposal: 0.90,
    referral_proposal_to_sale: 0.70,
  });
  
  useEffect(() => {
    if (config) {
      setFormData({
        outbound_call_to_lead: config.outbound_call_to_lead || 0.30,
        outbound_lead_to_mql: config.outbound_lead_to_mql || 0.79,
        outbound_mql_to_proposal: config.outbound_mql_to_proposal || 0.90,
        outbound_proposal_to_sale: config.outbound_proposal_to_sale || 0.54,
        inbound_lead_to_mql: config.inbound_lead_to_mql || 0.87,
        inbound_mql_to_proposal: config.inbound_mql_to_proposal || 0.90,
        inbound_proposal_to_sale: config.inbound_proposal_to_sale || 0.58,
        referral_request_to_lead: config.referral_request_to_lead || 0.35,
        referral_lead_to_proposal: config.referral_lead_to_proposal || 0.90,
        referral_proposal_to_sale: config.referral_proposal_to_sale || 0.70,
      });
    }
  }, [config]);
  
  return <ConversionRatesTab formData={formData} setFormData={setFormData} />;
}
