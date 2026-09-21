import type { QuoteHandoffPayload } from "@/lib/handoff";

export type SignStep =
  | "Draft"
  | "Sent to Customer"
  | "Customer Signed"
  | "Experience.com Countersigned"
  | "Fully Executed";
export type CrmSource = "Encompass" | "BytePro" | "Total Expert" | "AgencyZoom" | "Experience.com";

export interface Contact { name: string; role: string; is_signer: boolean; email: string }
export interface Deal { id: string; name: string; status: string }
export interface Contract {
  name: string; status: SignStep; generated: boolean; term_start: string; term_end: string; quote_amount: string;
}
export interface Document {
  name: string; type: string; version: string; created: string; status: string; signed: string; expiry: string;
  filename?: string; download_url?: string;
}
export interface Activity { at: string; text: string }
export interface Customer {
  id: string; name: string; source_crm: string; contacts: Contact[]; deals: Deal[];
  contract: Contract; documents: Document[]; activity: Activity[];
}
export interface AccountSummary { id: string; name: string; source_crm: string; contract_name: string }
export interface HandoffLead {
  id: string; source_crm: CrmSource; company: string; quote_amount: string; quote_version: string;
  status: "queued" | "accepted"; why_qualified: string; gaps: string[]; contacts: Contact[];
  accepted_at?: string; customer_id?: string; budget_context?: string;
}
export interface HandoffRun {
  lead_id: string; customer_id: string; company: string; source_crm: string; contract_name: string;
  merged: boolean; steps: string[]; gaps: string[];
}
export interface RenewalWatch {
  customer_id: string; name: string; source_crm: string; contract_name: string; quote_amount: string;
  signer: string; signer_email: string; term_end: string; days_until_expiry: number;
  status: "watching" | "due" | "snoozed" | "open" | "expired"; nudge_band?: string;
  last_nudge_band?: string; next_nudge?: string; last_activity: string; executed: boolean;
}
export interface RenewalRun {
  customer_id: string; company: string; action: string; nudge_band?: string; opened_deal: boolean;
  quote_draft: string; email_subject: string; email_body: string; steps: string[];
}
export interface ContractPackage {
  id: string; name: string; annual_price: number; display_price: string; features: string[];
  best_for: string; recommended: boolean;
}
export interface ContractNegotiation {
  status: "open" | "proposed" | "agreed"; selected_package_id: string; selected_package_name: string;
  concern: string; concern_label: string; concession_percent: number; list_price: string;
  final_price: string; suggestion: string; summary: string;
}
export interface SigningWatch {
  status: "not_sent" | "waiting_customer" | "customer_signed" | "countersigned" | "fully_executed";
  signer: string; signer_email: string; sent_at?: string; days_waiting: number; reminder_due_at?: string;
  reminder_due: boolean; reminder_sent_at?: string; reminder_count: number;
}
export interface AppState {
  now: string; sign_index: number; contract_generated: boolean; renewal_started: boolean; customer: Customer;
  customers: AccountSummary[]; days_until_expiry: number; renewal_due: boolean; inbox: HandoffLead[];
  last_handoff?: HandoffRun; watchlist: RenewalWatch[]; last_renewal?: RenewalRun;
  contract_packages: ContractPackage[]; negotiation: ContractNegotiation; signing_watch: SigningWatch;
}

export interface AccountState {
  customer: Customer; sign_index: number; contract_generated: boolean; renewal_started: boolean;
  days_until_expiry: number; renewal_due: boolean; quote_created: string; quote_accepted: string;
  quote_expiry: string; snoozed: boolean; last_nudge_band?: string; quote_draft: string;
  email_subject: string; email_body: string; selected_package_id: string; negotiation_summary: string;
  sent_at?: string; reminder_sent_at?: string; reminder_count: number;
}
export interface StoredContractState {
  now: string; active_id: string; accounts: Record<string, AccountState>; inbox: HandoffLead[];
  last_handoff?: HandoffRun; last_renewal?: RenewalRun;
}

export type ClockPreset = "start" | "signing_day_3" | "renewal_window" | "day_21" | "day_14" | "day_7";
export type RenewalAction = "run" | "snooze" | "nudge";
export type ContractMutation =
  | { type: "reset" }
  | { type: "clock"; preset: ClockPreset }
  | { type: "select"; customerId: string }
  | { type: "accept"; leadId: string }
  | { type: "generate" }
  | { type: "negotiate" }
  | { type: "send" }
  | { type: "advance" }
  | { type: "renewal-start" }
  | { type: "renewal-copilot"; customerId: string; action: RenewalAction };

export type { QuoteHandoffPayload };
