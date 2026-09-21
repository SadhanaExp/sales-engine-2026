import "server-only";

import { getPool } from "@/lib/db";
import type {
  AccountState, AppState, ClockPreset, Contact, ContractMutation, ContractPackage, HandoffLead,
  QuoteHandoffPayload, RenewalAction, RenewalWatch, StoredContractState,
} from "./types";

const CLOCK: Record<ClockPreset, string> = {
  start: "2026-09-18T09:00:00.000Z",
  signing_day_3: "2026-09-21T09:00:00.000Z",
  renewal_window: "2027-08-18T09:00:00.000Z",
  day_21: "2027-08-27T09:00:00.000Z",
  day_14: "2027-09-03T09:00:00.000Z",
  day_7: "2027-09-10T09:00:00.000Z",
};
const TERM_START = "2026-09-18";
const TERM_END = "2027-09-17";
const SIGN_STEPS = ["Draft", "Sent to Customer", "Customer Signed", "Experience.com Countersigned", "Fully Executed"] as const;
const AGREEMENTS: Record<string, string> = {
  Encompass: "Encompass Agreement", BytePro: "Experience.com Agreement", "Total Expert": "Experience.com Agreement",
  AgencyZoom: "Experience.com Agreement", "Experience.com": "Experience.com Agreement",
};
const CATALOG: Record<string, Array<[string, string, number, string[], string]>> = {
  "Total Expert": [
    ["te-essential", "Essential", 36000, ["Reputation management", "Surveys", "Standard support"], "Teams starting with core customer experience"],
    ["te-growth", "Growth", 48000, ["Reputation management", "Surveys", "Workflow automation", "Total Expert sync", "Priority support"], "Revenue teams needing CRM-connected workflows"],
    ["te-enterprise", "Enterprise", 66000, ["Everything in Growth", "Advanced analytics", "Multi-brand controls", "Dedicated success manager", "Custom workflows"], "Large organizations with governance needs"],
  ],
  Encompass: [
    ["enc-core", "Lending Core", 32000, ["Borrower surveys", "Review generation", "Encompass milestone sync"], "Mortgage teams beginning post-close automation"],
    ["enc-growth", "Lending Growth", 45000, ["Everything in Core", "Branch dashboards", "Loan officer workflows", "Priority support"], "Multi-branch lenders focused on growth"],
    ["enc-enterprise", "Lending Enterprise", 62000, ["Everything in Growth", "Enterprise analytics", "Custom Encompass events", "Dedicated success manager"], "Enterprise lenders with complex LOS operations"],
  ],
  BytePro: [
    ["bp-core", "Core", 24000, ["Customer surveys", "Review requests", "BytePro sync"], "Independent mortgage teams"],
    ["bp-growth", "Growth", 36000, ["Everything in Core", "Automated workflows", "Team analytics", "Priority support"], "Growing origination teams"],
    ["bp-enterprise", "Enterprise", 52000, ["Everything in Growth", "Custom reporting", "Multi-entity controls", "Dedicated success manager"], "Large lenders"],
  ],
  AgencyZoom: [
    ["az-core", "Agency Core", 18500, ["Policyholder surveys", "Review requests", "AgencyZoom sync"], "Independent agencies"],
    ["az-growth", "Agency Growth", 28000, ["Everything in Core", "Renewal workflows", "Producer analytics", "Priority support"], "Growing agencies"],
    ["az-enterprise", "Agency Enterprise", 42000, ["Everything in Growth", "Multi-office controls", "Custom workflows", "Dedicated success manager"], "Agency groups"],
  ],
};

const fmt = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const stamp = (value: string) => `${fmt(value)} ${new Date(value).toISOString().slice(11, 16)}`;
const moneyValue = (value: string) => Number(value.replace(/\D/g, "")) || 0;
const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")} / year`;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "customer";
const signer = (account: AccountState) => account.customer.contacts.find((c) => c.is_signer) ?? account.customer.contacts[0]!;
const daysBetween = (end: string, now: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(now.slice(0, 10) + "T00:00:00Z")) / 86_400_000);
const nudgeBand = (days: number) => days <= 0 ? undefined : days <= 7 ? "7" : days <= 14 ? "14" : days <= 21 ? "21" : days <= 30 ? "30" : undefined;
const bandLabel = (band?: string) => ({ "30": "30-day notice", "21": "21-day follow-up", "14": "14-day warning", "7": "7-day final notice" })[band ?? ""];

function baseAccount(id: string, name: string, crm: string, amount: string, contacts: Contact[]): AccountState {
  return {
    customer: {
      id, name, source_crm: crm, contacts, deals: [{ id: "initial", name: "Initial Purchase", status: "Quoted" }],
      contract: { name: AGREEMENTS[crm]!, status: "Draft", generated: false, term_start: TERM_START, term_end: TERM_END, quote_amount: amount },
      documents: [], activity: [
        { at: "18 Sep 2026 09:12", text: `Qualified deal handed off from ${crm}.` },
        { at: "18 Sep 2026 09:18", text: `Quote v2 accepted by ${contacts.find((c) => c.is_signer)?.name ?? contacts[0]?.name}.` },
      ],
    },
    sign_index: 0, contract_generated: false, renewal_started: false, days_until_expiry: 0, renewal_due: false,
    quote_created: "12 Sep 2026", quote_accepted: "18 Sep 2026", quote_expiry: "12 Oct 2026", snoozed: false,
    quote_draft: "", email_subject: "", email_body: "", selected_package_id: "", negotiation_summary: "",
    reminder_count: 0,
  };
}

function seedInbox(): HandoffLead[] {
  return [
    { id: "te-abc", source_crm: "Total Expert", company: "ABC Corp", quote_amount: "$48,000 / year", quote_version: "v2", status: "accepted", why_qualified: "Quote v2 accepted. Ops signer confirmed. Ready for Experience.com Agreement.", gaps: [], contacts: [{ name: "Priya Mehta", role: "VP Operations", is_signer: true, email: "priya@abccorp.example" }, { name: "Rajesh Iyer", role: "Finance", is_signer: false, email: "rajesh@abccorp.example" }], accepted_at: "18 Sep 2026 09:12", customer_id: "abc-corp" },
    { id: "enc-xyz", source_crm: "Encompass", company: "XYZ Corp", quote_amount: "$32,000 / year", quote_version: "v2", status: "accepted", why_qualified: "LOS file complete. Lending head is signer. Map to Encompass Agreement.", gaps: [], contacts: [{ name: "Sana Kapoor", role: "Head of Lending", is_signer: true, email: "sana@xyzcorp.example" }, { name: "Arjun Desai", role: "Compliance", is_signer: false, email: "arjun@xyzcorp.example" }], accepted_at: "18 Sep 2026 09:08", customer_id: "xyz-corp" },
    { id: "bp-pqr", source_crm: "BytePro", company: "PQR Lending", quote_amount: "$24,000 / year", quote_version: "v2", status: "queued", why_qualified: "Pipeline conversion > 40%. Quote v2 accepted in BytePro. Missing billing contact.", gaps: ["No billing / AP contact on the file"], contacts: [{ name: "Neha Rao", role: "COO", is_signer: true, email: "neha@pqrlending.example" }] },
    { id: "az-lakeside", source_crm: "AgencyZoom", company: "Lakeside Insurance", quote_amount: "$18,500 / year", quote_version: "v2", status: "queued", why_qualified: "Agency book of 1,200 policies. Principal signed the quote in AgencyZoom.", gaps: [], contacts: [{ name: "Omar Sheikh", role: "Principal", is_signer: true, email: "omar@lakeside.example" }, { name: "Leah Kim", role: "Office Manager", is_signer: false, email: "leah@lakeside.example" }] },
    { id: "enc-northstar", source_crm: "Encompass", company: "Northstar Credit Union", quote_amount: "$51,000 / year", quote_version: "v2", status: "queued", why_qualified: "Encompass LOS deal won. Credit committee approved. Use Encompass Agreement.", gaps: ["Order form not attached in CRM"], contacts: [{ name: "Dev Patel", role: "SVP Lending", is_signer: true, email: "dev@northstar.example" }, { name: "Maya Brooks", role: "General Counsel", is_signer: false, email: "maya@northstar.example" }] },
  ];
}

export function initialContractState(): StoredContractState {
  return {
    now: CLOCK.start, active_id: "abc-corp",
    accounts: {
      "abc-corp": baseAccount("abc-corp", "ABC Corp", "Total Expert", "$48,000 / year", [{ name: "Priya Mehta", role: "VP Operations", is_signer: true, email: "priya@abccorp.example" }, { name: "Rajesh Iyer", role: "Finance", is_signer: false, email: "rajesh@abccorp.example" }]),
      "xyz-corp": baseAccount("xyz-corp", "XYZ Corp", "Encompass", "$32,000 / year", [{ name: "Sana Kapoor", role: "Head of Lending", is_signer: true, email: "sana@xyzcorp.example" }, { name: "Arjun Desai", role: "Compliance", is_signer: false, email: "arjun@xyzcorp.example" }]),
    },
    inbox: seedInbox(),
  };
}

export function leadFromPayload(payload: QuoteHandoffPayload): HandoffLead {
  const dm = (payload.qualification.decision_maker ?? "").toLowerCase();
  const contacts = payload.contacts.filter((c) => c.name.trim()).map((c) => ({
    name: c.name, role: c.title ?? (c.is_primary ? "Primary contact" : "Contact"),
    is_signer: Boolean(dm) && (c.name.toLowerCase().includes(dm) || dm.includes(c.name.toLowerCase())), email: c.email ?? "",
  }));
  const detail = [payload.need.summary ?? payload.need.primary_need ?? "Requirement captured in the Lead & Deal Workspace."];
  if (payload.sizing.users) detail.push(`${payload.sizing.users} users`);
  if (payload.need.integrations.length) detail.push(`Integrations: ${payload.need.integrations.join(", ")}`);
  if (payload.insights[0]) detail.push(payload.insights[0]);
  if (payload.qualification.budget) detail.push(`Budget context: ${payload.qualification.budget}`);
  return {
    id: `se-${payload.opportunity.id}`, source_crm: "Experience.com", company: payload.customer.name,
    quote_amount: "To be quoted", quote_version: "v2", status: "queued",
    why_qualified: detail.map((s) => s.replace(/\.*$/, ".")).join(" "), gaps: payload.qualification.missing,
    contacts, customer_id: payload.customer.key || undefined, budget_context: payload.qualification.budget ?? undefined,
  };
}

function packages(account: AccountState): ContractPackage[] {
  const rows = CATALOG[account.customer.source_crm] ?? CATALOG["Total Expert"]!;
  const current = moneyValue(account.customer.contract.quote_amount);
  const recommendedId = rows.reduce((best, row) => Math.abs(row[2] - current) < Math.abs(best[2] - current) ? row : best)[0];
  return rows.map(([id, name, annual_price, features, best_for]) => ({ id, name, annual_price, display_price: usd(annual_price), features, best_for, recommended: id === recommendedId }));
}

function refresh(account: AccountState, now: string) {
  account.days_until_expiry = daysBetween(account.customer.contract.term_end, now);
  account.renewal_due = account.days_until_expiry > 0 && account.days_until_expiry <= 30 && !account.renewal_started && !account.snoozed;
  account.customer.contract.generated = account.contract_generated;
  account.customer.contract.status = SIGN_STEPS[account.sign_index]!;
  if (account.sign_index === 1 && account.sent_at && !account.reminder_sent_at && Date.parse(now) >= Date.parse(account.sent_at) + 259_200_000) {
    account.reminder_sent_at = now; account.reminder_count += 1;
    account.customer.activity.unshift({ at: stamp(now), text: `Automatic signature reminder #${account.reminder_count} sent to ${signer(account).name}.` });
  }
  if (account.sign_index >= 4) account.customer.deals.find((d) => d.id === "initial")!.status = "Won";
  account.customer.documents = documents(account, now);
}

function documents(account: AccountState, now: string) {
  const signed = account.sign_index >= 4;
  const c = account.customer.contract;
  return [
    { name: "Quote v1", type: "Quote", version: "v1", created: "04 Sep 2026", status: "Superseded", signed: "—", expiry: "—" },
    { name: "Quote v2", type: "Quote", version: "v2", created: account.quote_created, status: "Accepted", signed: account.quote_accepted, expiry: account.quote_expiry },
    { name: "Order Form", type: "Order Form", version: "v1", created: fmt(TERM_START), status: signed ? "Executed" : "Attached", signed: signed ? fmt(TERM_START) : "—", expiry: fmt(TERM_END) },
    { name: c.name, type: "Agreement", version: "v1", created: account.contract_generated ? fmt(CLOCK.start) : "—", status: account.sign_index ? SIGN_STEPS[account.sign_index]! : account.contract_generated ? "Draft" : "Pending", signed: account.sign_index >= 2 ? fmt(now) : "—", expiry: fmt(TERM_END) },
    { name: "Signed Contract", type: "Executed Agreement", version: "v1", created: signed ? fmt(now) : "—", status: signed ? "Fully Executed" : "Not created", signed: signed ? fmt(now) : "—", expiry: fmt(TERM_END), ...(signed ? { filename: `${account.customer.id}-executed-agreement.pdf`, download_url: `/api/contract/documents/${account.customer.id}/executed.pdf` } : {}) },
  ];
}

function watch(account: AccountState): RenewalWatch {
  const s = signer(account); const band = nudgeBand(account.days_until_expiry);
  const status = account.renewal_started ? "open" : account.days_until_expiry <= 0 ? "expired" : account.days_until_expiry > 30 ? "watching" : account.snoozed ? "snoozed" : "due";
  return { customer_id: account.customer.id, name: account.customer.name, source_crm: account.customer.source_crm, contract_name: account.customer.contract.name, quote_amount: account.customer.contract.quote_amount, signer: s.name, signer_email: s.email, term_end: account.customer.contract.term_end, days_until_expiry: account.days_until_expiry, status, nudge_band: band, last_nudge_band: account.last_nudge_band, next_nudge: account.renewal_started ? undefined : bandLabel(band), last_activity: account.customer.activity[0]?.text ?? "", executed: account.sign_index >= 4 };
}

export function snapshot(state: StoredContractState): AppState {
  Object.values(state.accounts).forEach((a) => refresh(a, state.now));
  const account = state.accounts[state.active_id] ?? Object.values(state.accounts)[0]!;
  const catalog = packages(account); const selected = catalog.find((p) => p.recommended)!;
  if (!account.selected_package_id) account.selected_package_id = selected.id;
  if (!account.negotiation_summary) account.negotiation_summary = `${selected.name} · quoted ${account.customer.contract.quote_amount}`;
  const sent = account.sent_at ? new Date(account.sent_at) : undefined;
  const reminderAt = sent ? new Date(sent.getTime() + 259_200_000).toISOString() : undefined;
  return {
    now: state.now, sign_index: account.sign_index, contract_generated: account.contract_generated,
    renewal_started: account.renewal_started, customer: account.customer,
    customers: Object.values(state.accounts).map((a) => ({ id: a.customer.id, name: a.customer.name, source_crm: a.customer.source_crm, contract_name: a.customer.contract.name })),
    days_until_expiry: account.days_until_expiry, renewal_due: account.renewal_due, inbox: state.inbox,
    last_handoff: state.last_handoff, watchlist: Object.values(state.accounts).map(watch), last_renewal: state.last_renewal,
    contract_packages: catalog,
    negotiation: { status: "agreed", selected_package_id: selected.id, selected_package_name: selected.name, concern: "none", concern_label: "Quoted terms", concession_percent: 0, list_price: selected.display_price, final_price: account.customer.contract.quote_amount, suggestion: "", summary: account.negotiation_summary },
    signing_watch: { status: ["not_sent", "waiting_customer", "customer_signed", "countersigned", "fully_executed"][account.sign_index] as AppState["signing_watch"]["status"], signer: signer(account).name, signer_email: signer(account).email, sent_at: account.sent_at, days_waiting: account.sign_index === 1 && sent ? Math.max(0, Math.floor((Date.parse(state.now) - sent.getTime()) / 86_400_000)) : 0, reminder_due_at: reminderAt, reminder_due: account.sign_index === 1 && Boolean(reminderAt && Date.parse(state.now) >= Date.parse(reminderAt) && !account.reminder_sent_at), reminder_sent_at: account.reminder_sent_at, reminder_count: account.reminder_count },
  };
}

function openRenewal(account: AccountState, now: string) {
  const opened = !account.renewal_started; account.renewal_started = true; account.snoozed = false;
  if (!account.customer.deals.some((d) => d.id === "renewal-2027")) account.customer.deals.push({ id: "renewal-2027", name: "Renewal 2027", status: "Open" });
  if (opened) account.customer.activity.unshift({ at: stamp(now), text: `Renewal 2027 deal opened on ${account.customer.name}. No new customer created.` });
  return opened;
}

function accept(state: StoredContractState, leadId: string) {
  const lead = state.inbox.find((item) => item.id === leadId || item.id === `se-${leadId}`);
  if (!lead) return;
  if (lead.status === "accepted" && lead.customer_id && state.accounts[lead.customer_id]) { state.active_id = lead.customer_id; return; }
  if (!lead.contacts.length) return;
  if (!lead.contacts.some((c) => c.is_signer)) lead.contacts[0]!.is_signer = true;
  const customerId = lead.customer_id || slug(lead.company); const merged = Boolean(state.accounts[customerId]);
  if (merged) {
    const account = state.accounts[customerId]!;
    account.customer.contract.quote_amount = lead.quote_amount; account.customer.source_crm = lead.source_crm;
    account.customer.contract.name = AGREEMENTS[lead.source_crm]!;
    account.customer.activity.unshift({ at: stamp(state.now), text: `Handoff agent refreshed ${lead.company} from ${lead.source_crm}. Same customer — no duplicate account.` });
  } else {
    state.accounts[customerId] = baseAccount(customerId, lead.company, lead.source_crm, lead.quote_amount, lead.contacts);
    state.accounts[customerId]!.quote_created = fmt(state.now); state.accounts[customerId]!.quote_accepted = fmt(state.now);
  }
  lead.status = "accepted"; lead.accepted_at = stamp(state.now); lead.customer_id = customerId; state.active_id = customerId;
  state.last_handoff = { lead_id: lead.id, customer_id: customerId, company: lead.company, source_crm: lead.source_crm, contract_name: AGREEMENTS[lead.source_crm]!, merged, steps: [`Read ${lead.source_crm} payload for ${lead.company}.`, `Detected signer ${signer(state.accounts[customerId]!).name}.`, `Mapped ${lead.source_crm} → ${AGREEMENTS[lead.source_crm]}.`, merged ? `${lead.company} already exists. Refreshed quote on the same record.` : `Created Customer 360 for ${lead.company}. Quote ${lead.quote_amount} and contacts attached.`], gaps: lead.gaps };
}

function renewalCopilot(state: StoredContractState, customerId: string, action: RenewalAction) {
  const account = state.accounts[customerId]; if (!account) return; state.active_id = customerId; refresh(account, state.now);
  const band = nudgeBand(account.days_until_expiry) ?? "30"; const quote = usd(moneyValue(account.customer.contract.quote_amount) * 1.05);
  const steps = [`Scanned portfolio. Focused ${account.customer.name} (${account.customer.source_crm}).`, `${account.days_until_expiry} days left. Cadence: ${bandLabel(band) ?? "outside notice window"}.`];
  if (account.days_until_expiry > 30 && action !== "snooze") steps.push("Outside the 30-day window. Jump the demo clock to 11 months later, then run again.");
  else if (action === "snooze") { account.snoozed = true; account.last_nudge_band = band; steps.push("Snoozed. Will re-nudge at the next cadence."); }
  else {
    account.quote_draft = quote; account.last_nudge_band = band;
    account.email_subject = `${account.customer.name} · ${account.customer.contract.name} renews in ${account.days_until_expiry} days`;
    account.email_body = `Hi ${signer(account).name.split(" ")[0]},\n\nYour ${account.customer.contract.name} term ends on ${fmt(account.customer.contract.term_end)}.\n\nDraft Renewal 2027 quote: ${quote}.`;
    if (action === "run") { const opened = openRenewal(account, state.now); steps.push(`Drafted Renewal 2027 quote ${quote} (5% on current).`, opened ? "Opened Renewal 2027 under Deals on this customer. No duplicate account." : "Renewal 2027 was already open on this customer."); }
    else { account.snoozed = true; steps.push(`Re-nudged at ${bandLabel(band)}.`); }
  }
  state.last_renewal = { customer_id: customerId, company: account.customer.name, action, nudge_band: band, opened_deal: account.renewal_started, quote_draft: account.quote_draft, email_subject: account.email_subject, email_body: account.email_body, steps };
}

function applyMutation(state: StoredContractState, mutation: ContractMutation): StoredContractState {
  if (mutation.type === "reset") {
    Object.assign(state, initialContractState());
    return state;
  }
  const account = state.accounts[state.active_id] ?? Object.values(state.accounts)[0]!;
  switch (mutation.type) {
    case "clock": state.now = CLOCK[mutation.preset]; break;
    case "select": if (state.accounts[mutation.customerId]) state.active_id = mutation.customerId; break;
    case "accept": accept(state, mutation.leadId); break;
    case "generate": {
      const selected = packages(account).find((p) => p.recommended)!; account.selected_package_id = selected.id;
      account.negotiation_summary = `${selected.name} · quoted ${account.customer.contract.quote_amount}`;
      if (!account.contract_generated) { account.contract_generated = true; account.customer.activity.unshift({ at: stamp(state.now), text: `${account.customer.contract.name} generated from quoted ${selected.name} plan at ${account.customer.contract.quote_amount}.` }); }
      break;
    }
    case "negotiate": {
      const selected = packages(account).find((p) => p.recommended)!; account.selected_package_id = selected.id;
      account.negotiation_summary = `${selected.name} · quoted ${account.customer.contract.quote_amount}`; break;
    }
    case "send":
      if (account.contract_generated && account.sign_index === 0) { account.sign_index = 1; account.sent_at = state.now; account.reminder_sent_at = undefined; account.reminder_count = 0; account.customer.activity.unshift({ at: stamp(state.now), text: `${account.customer.contract.name} sent for signature to ${signer(account).name}.` }); }
      break;
    case "advance":
      if (account.contract_generated && account.sign_index < 4) { account.sign_index += 1; const notes = ["", "", `Customer signed ${account.customer.contract.name}.`, "Experience.com countersigned.", `${account.customer.contract.name} fully executed. Signed Contract stored on ${account.customer.name}. Initial Purchase → Won.`]; account.customer.activity.unshift({ at: stamp(state.now), text: notes[account.sign_index]! }); }
      break;
    case "renewal-start":
      if (account.days_until_expiry > 30) state.now = CLOCK.renewal_window; refresh(account, state.now); openRenewal(account, state.now); break;
    case "renewal-copilot": renewalCopilot(state, mutation.customerId, mutation.action); break;
  }
  return state;
}

async function locked<T>(work: (state: StoredContractState) => T): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into contract_workspace_state (id, state) values ('default', $1::jsonb)
       on conflict (id) do nothing`,
      [JSON.stringify(initialContractState())],
    );
    const { rows } = await client.query<{ state: StoredContractState }>(
      "select state from contract_workspace_state where id = 'default' for update",
    );
    const state = rows[0]!.state; const result = work(state);
    await client.query(
      `update contract_workspace_state set state = $1::jsonb, version = version + 1, updated_at = now()
       where id = 'default'`,
      [JSON.stringify(state)],
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getContractState(): Promise<AppState> {
  return locked((state) => snapshot(state));
}
export async function mutateContractState(mutation: ContractMutation): Promise<AppState> {
  return locked((state) => snapshot(applyMutation(state, mutation)));
}
export async function enqueueQuoteHandoff(payload: QuoteHandoffPayload): Promise<HandoffLead> {
  return locked((state) => {
    const lead = leadFromPayload(payload); const index = state.inbox.findIndex((item) => item.id === lead.id);
    if (index >= 0) { lead.customer_id = state.inbox[index]!.customer_id || lead.customer_id; state.inbox[index] = lead; }
    else state.inbox.unshift(lead);
    return lead;
  });
}
export async function getContractHandoff(leadId: string): Promise<HandoffLead | null> {
  return locked((state) => state.inbox.find((item) => item.id === leadId || item.id === `se-${leadId}`) ?? null);
}
export async function getExecutedCustomer(customerId: string) {
  return locked((state) => {
    const account = state.accounts[customerId];
    return account && account.sign_index >= 4 ? account.customer : null;
  });
}
