import Link from "next/link";
import { listLeadRows } from "@/lib/repo/leads";
import { requireContractAccess } from "@/lib/authz";
import { accountKeyFor } from "@/lib/handoff";
import { DOWNSTREAM } from "@/lib/modules";
import { ReadyToContract } from "@/components/contract/ready-to-contract";
import { OpportunitySwitcher } from "@/components/workspace/opportunity-switcher";

/**
 * Ready to Contract is a native workspace. The server owns access control and
 * opportunity selection; the interactive contract workflow starts at the
 * client boundary below.
 */
export default async function GuidedSellingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireContractAccess();
  const sp = await searchParams;
  const selected = typeof sp.lead === "string" ? sp.lead : null;
  const rows = await listLeadRows();
  const inModule = rows.filter((r) => r.status === "quoted" || r.status === "won");
  const current = inModule.find((r) => r.id === selected) ?? inModule[0] ?? null;
  const customerId = current
    ? accountKeyFor({
        id: current.company_id,
        name: current.company_name,
        domain: current.company_domain,
        industry: current.company_industry,
        created_at: current.created_at,
      })
    : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5">
        <div className="flex min-w-0 items-center gap-2.5 text-sm">
          <span className="shrink-0 font-semibold text-foreground">{DOWNSTREAM.name}</span>
          {current && (
            <>
              <span className="text-muted-foreground">/</span>
              <OpportunitySwitcher
                current={current.id}
                options={inModule.map((r) => ({
                  id: r.id,
                  label: r.company_name,
                  // Only "Won" is worth the space — everything in this list is
                  // already at this stage, so repeating the stage name truncates
                  // the company name for nothing.
                  hint: r.status === "won" ? "Won" : null,
                }))}
              />
              <Link href={`/leads/${current.id}`} className="hidden shrink-0 text-[13px] text-muted-foreground hover:text-foreground sm:inline">
                Open opportunity
              </Link>
            </>
          )}
        </div>
      </div>

      {current ? (
        <ReadyToContract key={current.id} leadId={current.id} customerId={customerId} />
      ) : (
        <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
          No quoted or won opportunities are ready for contract.
        </div>
      )}
    </div>
  );
}
