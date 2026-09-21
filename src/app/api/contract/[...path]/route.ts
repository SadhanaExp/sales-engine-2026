import { assertContractAccess } from "@/lib/authz";
import {
  enqueueQuoteHandoff, getContractHandoff, getContractState, getExecutedCustomer, mutateContractState,
} from "@/lib/contract/store";
import type { ClockPreset, QuoteHandoffPayload, RenewalAction } from "@/lib/contract/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });
const notFound = (detail = "Not found") => Response.json({ detail }, { status: 404 });
const badRequest = (detail: string) => Response.json({ detail }, { status: 400 });

async function json(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function pdfText(customerName: string, agreementName: string): string {
  const safe = (value: string) => value.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 18 Tf 72 740 Td (Experience.com) Tj 0 -36 Td /F1 14 Tf (${safe(agreementName)}) Tj 0 -28 Td /F1 11 Tf (Fully Executed Agreement for ${safe(customerName)}) Tj 0 -22 Td (Both parties have signed and countersigned this agreement.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return output;
}

export async function GET(_request: Request, context: Context) {
  if (!(await assertContractAccess())) return forbidden();
  const { path } = await context.params;
  if (path.length === 1 && path[0] === "state") return Response.json(await getContractState());

  if (path[0] === "handoffs" && path.length === 2) {
    const lead = await getContractHandoff(decodeURIComponent(path[1]!));
    return lead ? Response.json(lead) : notFound("Handoff not found");
  }

  if (path[0] === "documents" && path.length === 3 && path[2] === "executed.pdf") {
    const customer = await getExecutedCustomer(decodeURIComponent(path[1]!));
    if (!customer) return notFound("The executed PDF is available after both parties have signed.");
    return new Response(pdfText(customer.name, customer.contract.name), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${customer.id}-executed-agreement.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }
  return notFound();
}

export async function POST(request: Request, context: Context) {
  if (!(await assertContractAccess())) return forbidden();
  const { path } = await context.params;
  const route = path.join("/");
  const body = await json(request);

  if (route === "reset") return Response.json(await mutateContractState({ type: "reset" }));
  if (route === "clock") {
    const preset = body?.preset;
    if (!["start", "signing_day_3", "renewal_window", "day_21", "day_14", "day_7"].includes(String(preset))) return badRequest("Invalid clock preset");
    return Response.json(await mutateContractState({ type: "clock", preset: preset as ClockPreset }));
  }
  if (route === "account/select") {
    if (typeof body?.customer_id !== "string") return badRequest("customer_id is required");
    return Response.json(await mutateContractState({ type: "select", customerId: body.customer_id }));
  }
  if (route === "handoffs") {
    if (!body || typeof body.opportunity !== "object" || typeof body.customer !== "object") return badRequest("Invalid handoff payload");
    const lead = await enqueueQuoteHandoff(body as unknown as QuoteHandoffPayload);
    return Response.json(lead, { status: 202 });
  }
  if (route === "handoff/accept") {
    if (typeof body?.lead_id !== "string") return badRequest("lead_id is required");
    return Response.json(await mutateContractState({ type: "accept", leadId: body.lead_id }));
  }
  if (route === "generate" || route === "contract/generate") return Response.json(await mutateContractState({ type: "generate" }));
  if (route === "negotiate" || route === "contract/negotiate") return Response.json(await mutateContractState({ type: "negotiate" }));
  if (route === "send" || route === "contract/send") return Response.json(await mutateContractState({ type: "send" }));
  if (route === "signing/advance") return Response.json(await mutateContractState({ type: "advance" }));
  if (route === "renewal/start") return Response.json(await mutateContractState({ type: "renewal-start" }));
  if (route === "renewal/copilot") {
    if (typeof body?.customer_id !== "string" || !["run", "snooze", "nudge"].includes(String(body.action ?? "run"))) return badRequest("Invalid renewal request");
    return Response.json(await mutateContractState({ type: "renewal-copilot", customerId: body.customer_id, action: (body.action ?? "run") as RenewalAction }));
  }
  return notFound();
}
