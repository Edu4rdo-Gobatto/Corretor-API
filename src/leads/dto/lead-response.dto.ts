import { Lead } from '../lead.entity';

export type LeadResponse = {
  id: string;
  propertyId: string | null;
  agentId: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  message: string | null;
  consentGiven: boolean;
  consentTimestamp: Date;
  consentIp: string;
  termsVersion: string;
  createdAt: Date;
};

export function toLeadResponse(lead: Lead): LeadResponse {
  return {
    id: lead.id,
    propertyId: lead.propertyId,
    agentId: lead.agentId,
    leadName: lead.leadName,
    leadPhone: lead.leadPhone,
    leadEmail: lead.leadEmail,
    message: lead.message,
    consentGiven: lead.consentGiven,
    consentTimestamp: lead.consentTimestamp,
    consentIp: lead.consentIp,
    termsVersion: lead.termsVersion,
    createdAt: lead.createdAt,
  };
}
