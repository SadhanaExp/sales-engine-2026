"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bot,
  Download,
  FileCheck2,
  FileText,
  Handshake,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  PenLine,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AgentRun, ContractState, ContractView, HandoffLead, RenewalWatch } from "./types";

const API = "/api/contract";
const nav: Array<{ id: ContractView; label: string; icon: typeof Bot }> = [
  { id: "handoff", label: "Lead handoff", icon: Handshake },
  { id: "customer", label: "Customer 360", icon: LayoutDashboard },
  { id: "contract", label: "Contract", icon: FileText },
  { id: "signing", label: "Document signing", icon: PenLine },
  { id: "documents", label: "Documents", icon: FileCheck2 },
  { id: "renewal", label: "Renewal copilot", icon: Bot },
];
const signSteps = ["Draft", "Sent to Customer", "Customer Signed", "Experience.com Countersigned", "Fully Executed"];

async function api(path: string, body?: unknown): Promise<ContractState> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<ContractState>;
}

function formatDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "open" || status === "accepted" || status === "agreed" || status === "Fully Executed"
      ? "success"
      : status === "due" || status === "queued"
        ? "warning"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

type Act = (path: string, body?: unknown, view?: ContractView) => void;
interface ViewProps {
  state: ContractState;
  act: Act;
}

function AgentPanel({ run, title }: { run?: AgentRun; title: string }) {
  return (
    <Card className="h-fit">
      <CardHeader><Eyebrow>{title}</Eyebrow><CardTitle>{run?.company ?? "Waiting to run"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {run ? (
          <>
            <ol className="space-y-3 pl-5 text-sm text-[#33517f]">
              {run.steps.map((step) => <li key={step} className="list-decimal">{step}</li>)}
            </ol>
            {run.quote_draft && <div className="rounded-xl border bg-muted p-4"><Eyebrow>Draft quote</Eyebrow><strong>{run.quote_draft}</strong></div>}
            {run.email_body && (
              <div className="rounded-xl border bg-muted p-4">
                <Eyebrow>Draft email</Eyebrow>
                <strong className="block text-sm">{run.email_subject}</strong>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-muted-foreground">{run.email_body}</pre>
              </div>
            )}
          </>
        ) : <p className="text-sm leading-6 text-muted-foreground">Select an action and the agent’s decisions will appear here.</p>}
      </CardContent>
    </Card>
  );
}

function LeadCard({ lead, act }: { lead: HandoffLead; act: Act }) {
  const signer = lead.contacts.find((item) => item.is_signer) ?? lead.contacts[0];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-bold">{lead.company}</h3><p className="text-xs text-muted-foreground">{lead.quote_amount}</p></div>
          <StatusBadge status={lead.status} />
        </div>
        <p className="my-3 text-sm leading-6 text-[#33517f]">{lead.why_qualified}</p>
        <p className="text-xs text-muted-foreground">Signer: {signer?.name ?? "Missing"}</p>
        {lead.gaps.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{lead.gaps.map((gap) => <Badge key={gap} variant="warning">{gap}</Badge>)}</div>}
        <div className="mt-4">
          {lead.status === "queued" ? (
            <Button size="sm" onClick={() => act("/handoff/accept", { lead_id: lead.id })}>Accept handoff</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => act("/account/select", { customer_id: lead.customer_id }, "customer")}>Open Customer 360</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HandoffView({ state, act }: ViewProps) {
  const queued = state.inbox.filter((lead) => lead.status === "queued");
  const accepted = state.inbox.filter((lead) => lead.status === "accepted");
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card><CardHeader><Eyebrow>Inbound queue</Eyebrow><CardTitle>{queued.length} qualified deals waiting</CardTitle><p className="text-sm text-muted-foreground">CRM payload → signer detection → agreement mapping → Customer 360.</p></CardHeader></Card>
        {queued.map((lead) => <LeadCard key={lead.id} lead={lead} act={act} />)}
        <Card>
          <CardHeader><Eyebrow>Already in workspace</Eyebrow></CardHeader>
          <CardContent className="space-y-3">{accepted.map((lead) => <LeadCard key={lead.id} lead={lead} act={act} />)}</CardContent>
        </Card>
      </div>
      <AgentPanel run={state.last_handoff} title="Handoff agent" />
    </div>
  );
}

function CustomerView({ state }: ViewProps) {
  const c = state.customer;
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader><Eyebrow>Account structure</Eyebrow><CardTitle>One customer, many deals</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section><strong>{c.name}</strong></section>
          <section><Eyebrow>Contacts</Eyebrow>{c.contacts.map((person) => <p key={`${person.name}-${person.email}`}>{person.name} — {person.role}{person.is_signer && <Badge className="ml-2">signer</Badge>}</p>)}</section>
          <section><Eyebrow>Deals</Eyebrow>{c.deals.map((deal) => <p key={deal.id} className="flex justify-between gap-2">{deal.name}<StatusBadge status={deal.status} /></p>)}</section>
          <section><Eyebrow>Contract</Eyebrow><p>{c.contract.status}</p></section>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><Eyebrow>Activity</Eyebrow><CardTitle>What happened on this account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {c.activity.map((item, index) => <div key={`${item.at}-${index}`} className="grid gap-2 border-b pb-4 text-sm sm:grid-cols-[130px_1fr]"><time className="font-mono text-xs text-muted-foreground">{item.at}</time><span>{item.text}</span></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractView({ state, act }: ViewProps) {
  const c = state.customer;
  const quoted = state.contract_packages.find((item) => item.recommended) ?? state.contract_packages[0];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Customer", c.name], ["Quote", c.contract.quote_amount], ["Agreement", c.contract.name], ["Status", state.contract_generated ? c.contract.status : "Not generated"]].map(([label, value]) => (
          <Card key={label}><CardContent className="p-5"><Eyebrow>{label}</Eyebrow><p className="text-xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>
      {quoted && (
        <Card>
          <CardHeader><Eyebrow>Quoted plan</Eyebrow><CardTitle>{quoted.name}</CardTitle><p className="text-sm text-muted-foreground">This is the accepted quote. Commercial terms stay locked to this plan.</p></CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-primary/30 bg-white p-5">
              <div className="flex justify-between gap-3"><div><h3 className="font-bold">{quoted.name}</h3><p className="mt-1 text-lg font-bold text-primary">{c.contract.quote_amount}</p></div><Badge>Quoted</Badge></div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{quoted.best_for}</p>
              <ul className="mt-4 space-y-2 text-sm text-[#33517f]">{quoted.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-primary">✓</span>{feature}</li>)}</ul>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><Eyebrow>Contract draft</Eyebrow><CardTitle>{c.contract.name}</CardTitle><p className="text-sm text-muted-foreground">Term {formatDate(c.contract.term_start)} → {formatDate(c.contract.term_end)} · {c.contract.quote_amount}</p></CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-white p-6 text-sm leading-7 text-[#33517f]">
            {state.contract_generated
              ? `This Agreement is entered into by Experience.com and ${c.name}. Commercial terms: ${state.negotiation.selected_package_name} at ${c.contract.quote_amount}. The initial term is twelve months and renews unless notice is given thirty days before expiry.`
              : `No file yet. Generate the agreement from the accepted ${quoted?.name ?? "quoted"} plan at ${c.contract.quote_amount}.`}
          </div>
          <div className="mt-4 flex gap-2">
            <Button disabled={state.contract_generated} onClick={() => act("/contract/generate", {})}>Generate contract</Button>
            <Button variant="secondary" disabled={!state.contract_generated || state.sign_index > 0} onClick={() => act("/contract/send", {}, "signing")}>Send for signature</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PdfDownload({ href, label = "Download PDF" }: { href: string; label?: string }) {
  const nativeHref = href.startsWith("/api/") && !href.startsWith(API) ? `${API}${href.slice(4)}` : href;
  return <a className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-navy px-3 text-xs font-semibold text-white hover:bg-navy/90" href={nativeHref} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />{label}</a>;
}

function SigningView({ state, act }: ViewProps) {
  const watch = state.signing_watch;
  const waiting = watch.status === "waiting_customer";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader><Eyebrow>Signature envelope</Eyebrow><CardTitle>{state.customer.contract.name} · {state.customer.name}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">{signSteps.map((step, index) => <div key={step} className="flex items-center gap-3 py-3"><span className={cn("h-4 w-4 rounded-full border-2", index < state.sign_index ? "border-primary bg-primary" : index === state.sign_index ? "border-amber-500 bg-amber-500 ring-4 ring-amber-100" : "border-border")} /><span className={cn("font-medium", index > state.sign_index && "text-muted-foreground")}>{step}</span></div>)}</div>
          <Button className="mt-4" disabled={!state.contract_generated || state.sign_index >= 4} onClick={() => act("/signing/advance", {})}>{state.sign_index >= 4 ? "Fully executed" : state.sign_index === 1 ? "Record customer signature" : "Advance signing"}</Button>
          {state.sign_index >= 4 && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4"><Eyebrow>Executed original</Eyebrow><p className="mb-3 text-sm text-green-900">Both parties have signed. This is the official agreement for {state.customer.name}.</p><PdfDownload href={`/api/documents/${state.customer.id}/executed.pdf`} label="Open executed PDF" /></div>}
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><Eyebrow>Customer signature watch</Eyebrow><div className="flex items-center justify-between gap-3"><CardTitle>{waiting ? "Waiting for customer" : watch.status === "not_sent" ? "Not sent yet" : watch.status.replaceAll("_", " ")}</CardTitle><StatusBadge status={waiting ? "waiting" : watch.status} /></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted p-4 text-sm"><p className="font-semibold">{watch.signer}</p><p className="text-muted-foreground">{watch.signer_email || "No email on file"}</p></div>
          {watch.sent_at && <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-muted-foreground">Sent</dt><dd>{formatDate(watch.sent_at)}</dd><dt className="text-muted-foreground">Waiting</dt><dd>{watch.days_waiting} day{watch.days_waiting === 1 ? "" : "s"}</dd><dt className="text-muted-foreground">Reminder due</dt><dd>{watch.reminder_due_at ? formatDate(watch.reminder_due_at) : "—"}</dd></dl>}
          {waiting && !watch.reminder_sent_at && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>3-day follow-up scheduled</strong><p className="mt-1">If still unsigned, the system automatically emails {watch.signer} after three days.</p></div>}
          {watch.reminder_sent_at && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><strong className="flex items-center gap-2"><Mail className="h-4 w-4" />Reminder sent</strong><p className="mt-1">Reminder #{watch.reminder_count} sent on {formatDate(watch.reminder_sent_at)}.</p></div>}
          {waiting && <Button variant="secondary" size="sm" onClick={() => act("/clock", { preset: "signing_day_3" }, "signing")}>Demo: 3 days later</Button>}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsView({ state }: ViewProps) {
  const executed = state.customer.documents.find((doc) => doc.download_url);
  return (
    <div className="space-y-5">
      {executed?.download_url ? (
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Eyebrow>Fully executed original</Eyebrow><CardTitle>{executed.filename}</CardTitle><p className="mt-2 text-sm text-muted-foreground">Signed by both parties on {executed.signed}. This is the stored PDF copy.</p></div><PdfDownload href={executed.download_url} /></div></CardHeader></Card>
      ) : <Card><CardContent className="p-5 text-sm text-muted-foreground">The downloadable PDF appears here after both parties sign.</CardContent></Card>}
      <Card className="overflow-hidden">
        <CardHeader><Eyebrow>Inside the customer</Eyebrow><CardTitle>Documents · {state.customer.name}</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr>{["Document", "Type", "Version", "Status", "Signed", "Expiry", ""].map((heading) => <th key={heading || "action"} className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>{state.customer.documents.map((doc) => <tr key={`${doc.name}-${doc.version}`} className="border-t"><td className="px-5 py-4 font-semibold">{doc.name}</td><td className="px-5 py-4">{doc.type}</td><td className="px-5 py-4">{doc.version}</td><td className="px-5 py-4"><StatusBadge status={doc.status} /></td><td className="px-5 py-4">{doc.signed}</td><td className="px-5 py-4">{doc.expiry}</td><td className="px-5 py-4">{doc.download_url ? <PdfDownload href={doc.download_url} /> : "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RenewalCard({ item, act }: { item: RenewalWatch; act: Act }) {
  const actionable = ["due", "snoozed", "open"].includes(item.status);
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="text-xs text-muted-foreground">{item.quote_amount}</p></div><StatusBadge status={`${item.status}${item.days_until_expiry > 0 ? ` · ${item.days_until_expiry}d` : ""}`} /></div>
      <p className="my-3 text-sm">Signer: {item.signer}{item.signer_email && ` · ${item.signer_email}`}</p>
      <p className="text-xs text-muted-foreground">{item.next_nudge && `Next: ${item.next_nudge}. `}{item.last_activity}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={!actionable} onClick={() => act("/renewal/copilot", { customer_id: item.customer_id, action: "run" }, "renewal")}>Run copilot</Button>
        <Button size="sm" variant="secondary" disabled={item.status !== "due"} onClick={() => act("/renewal/copilot", { customer_id: item.customer_id, action: "snooze" }, "renewal")}>Snooze</Button>
        <Button size="sm" variant="secondary" disabled={item.status !== "snoozed"} onClick={() => act("/renewal/copilot", { customer_id: item.customer_id, action: "nudge" }, "renewal")}>Send nudge</Button>
      </div>
    </CardContent></Card>
  );
}

function RenewalView({ state, act }: ViewProps) {
  const due = state.watchlist.filter((item) => ["due", "snoozed"].includes(item.status)).length;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card><CardHeader><Eyebrow>Portfolio watch</Eyebrow><CardTitle>{due ? `${due} accounts in the notice window` : "No accounts in the 30-day window"}</CardTitle></CardHeader><CardContent><div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Cadence clock</span>{[["renewal_window", "30 days"], ["day_21", "21"], ["day_14", "14"], ["day_7", "7"]].map(([preset, label]) => <Button key={preset} size="sm" variant="secondary" onClick={() => act("/clock", { preset }, "renewal")}>{label}</Button>)}</div></CardContent></Card>
        {state.watchlist.map((item) => <RenewalCard key={item.customer_id} item={item} act={act} />)}
      </div>
      <AgentPanel run={state.last_renewal} title="Renewal copilot" />
    </div>
  );
}

export function ReadyToContract({ leadId, customerId }: { leadId: string | null; customerId: string | null }) {
  const [state, setState] = useState<ContractState>();
  const [view, setView] = useState<ContractView>("handoff");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const due = useMemo(() => state?.watchlist.filter((item) => item.status === "due") ?? [], [state]);

  useEffect(() => {
    let active = true;
    api("/state")
      .then(async (initial) => {
        const lead = leadId ? initial.inbox.find((item) => item.id === leadId || item.id === `se-${leadId}`) : undefined;
        if (lead?.status === "queued") return { state: initial, view: "handoff" as const };
        const selectedCustomer = lead?.customer_id ?? customerId;
        if (selectedCustomer && initial.customers.some((item) => item.id === selectedCustomer)) {
          return { state: await api("/account/select", { customer_id: selectedCustomer }), view: "customer" as const };
        }
        return { state: initial, view: lead ? "handoff" as const : "customer" as const };
      })
      .then((result) => { if (active) { setState(result.state); setView(result.view); } })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [leadId, customerId]);

  const act = useCallback<Act>(async (path, body, nextView) => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await api(path, body);
      setState(next);
      if (path === "/clock" && next.watchlist.some((item) => item.status === "due")) setReminderOpen(true);
      if (nextView) setView(nextView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!state) return <div className="grid min-h-[28rem] place-items-center">{error ?? <LoaderCircle className="animate-spin text-primary" />}</div>;
  const queued = state.inbox.filter((lead) => lead.status === "queued").length;
  const viewNode = {
    handoff: <HandoffView state={state} act={act} />,
    customer: <CustomerView state={state} act={act} />,
    contract: <ContractView state={state} act={act} />,
    signing: <SigningView state={state} act={act} />,
    documents: <DocumentsView state={state} act={act} />,
    renewal: <RenewalView state={state} act={act} />,
  }[view];

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <main className="p-5 md:p-6">
        <nav className="mb-5 flex flex-wrap items-center gap-0.5 border-b pb-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return <button type="button" key={item.id} onClick={() => setView(item.id)} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground", view === item.id && "bg-muted font-semibold text-foreground")}><Icon className="h-4 w-4" />{item.label}</button>;
          })}
        </nav>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{view === "customer" ? state.customer.name : nav.find((item) => item.id === view)?.label}</h1>
          <div className="flex gap-2"><Badge>{view === "handoff" ? `Inbox · ${queued} queued` : state.customer.name}</Badge><Badge variant="warning">{view === "handoff" ? `${queued} queued` : state.customer.contract.quote_amount}</Badge></div>
        </header>
        {due.length > 0 && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0d2463] via-[#183b8b] to-[#2b67f3] p-4 text-white shadow-lg"><div><strong className="flex items-center gap-2"><BellRing className="h-4 w-4" />Renewal copilot</strong><p className="mt-1 text-sm text-white/75">{due.length} account{due.length === 1 ? "" : "s"} in the 30-day window.</p></div><Button size="sm" onClick={() => setView("renewal")}>Open copilot</Button></div>}
        {error && <div className="mb-4 rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div>}
        <div className={cn(busy && "pointer-events-none opacity-60")}>{viewNode}</div>
      </main>
      <Dialog open={reminderOpen && due.length > 0} onOpenChange={setReminderOpen}>
        <DialogContent><DialogHeader><Eyebrow>Renewal copilot</Eyebrow><DialogTitle>{due.length} agreement{due.length === 1 ? "" : "s"} expiring</DialogTitle><DialogDescription>{due.map((item) => `${item.name} (${item.days_until_expiry}d)`).join(" · ")}</DialogDescription></DialogHeader><div className="flex gap-2"><Button onClick={() => { setView("renewal"); setReminderOpen(false); }}><Bot className="h-4 w-4" />Open watchlist</Button><Button variant="secondary" onClick={() => setReminderOpen(false)}>Remind me later</Button></div></DialogContent>
      </Dialog>
      {busy && <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-lg"><RefreshCw className="h-4 w-4 animate-spin" />Working</div>}
    </div>
  );
}
