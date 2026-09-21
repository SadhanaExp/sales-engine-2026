export type ContractView = "handoff" | "customer" | "contract" | "signing" | "documents" | "renewal";

export interface Contact {
  name: string;
  role: string;
  is_signer: boolean;
  email: string;
}

export interface HandoffLead {
  id: string;
  company: string;
  quote_amount: string;
  status: "queued" | "accepted";
  why_qualified: string;
  gaps: string[];
  contacts: Contact[];
  customer_id?: string;
}

export interface AgentRun {
  company: string;
  steps: string[];
  quote_draft?: string;
  email_subject?: string;
  email_body?: string;
}

export interface RenewalWatch {
  customer_id: string;
  name: string;
  quote_amount: string;
  signer: string;
  signer_email: string;
  days_until_expiry: number;
  status: "watching" | "due" | "snoozed" | "open" | "expired";
  next_nudge?: string;
  last_activity: string;
}

export interface Customer {
  id: string;
  name: string;
  contacts: Contact[];
  deals: Array<{ id: string; name: string; status: string }>;
  contract: {
    name: string;
    status: string;
    term_start: string;
    term_end: string;
    quote_amount: string;
  };
  documents: Array<{
    name: string;
    type: string;
    version: string;
    status: string;
    signed: string;
    expiry: string;
    filename?: string;
    download_url?: string;
  }>;
  activity: Array<{ at: string; text: string }>;
}

export interface ContractState {
  now: string;
  sign_index: number;
  contract_generated: boolean;
  customer: Customer;
  customers: Array<{ id: string; name: string }>;
  inbox: HandoffLead[];
  last_handoff?: AgentRun;
  watchlist: RenewalWatch[];
  last_renewal?: AgentRun;
  contract_packages: Array<{
    id: string;
    name: string;
    features: string[];
    best_for: string;
    recommended: boolean;
  }>;
  negotiation: {
    selected_package_name: string;
  };
  signing_watch: {
    status: "not_sent" | "waiting_customer" | "customer_signed" | "countersigned" | "fully_executed";
    signer: string;
    signer_email: string;
    sent_at?: string;
    days_waiting: number;
    reminder_due_at?: string;
    reminder_sent_at?: string;
    reminder_count: number;
  };
}
