// Server fn لجلب الإيميلات لمهمّة مكتملة
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ jobId: z.string().uuid() });

export const scrapeJobEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scrapeEmailsFromSite } = await import("@/lib/email-scraper.server");
    const { runInBatches } = await import("@/lib/enrich.server");

    // قراءة الصفوف التي لها موقع ولم تُعالَج بعد
    const { data: rows, error } = await supabaseAdmin
      .from("scrape_results")
      .select("id, website, email, email_scraped_at")
      .eq("job_id", data.jobId)
      .neq("website", "")
      .limit(5000);

    if (error) throw new Error(error.message);

    const targets = (rows ?? []).filter((r) => !r.email || !r.email_scraped_at);
    let withEmail = 0;
    let processed = 0;

    await runInBatches(targets, 6, async (row) => {
      try {
        const r = await scrapeEmailsFromSite(row.website as string);
        const now = new Date().toISOString();
        if (r.primary) withEmail++;
        await (supabaseAdmin.from("scrape_results") as unknown as {
          update: (p: unknown) => { eq: (a: string, b: string) => Promise<{ error: unknown }> };
        })
          .update({
            email: r.primary,
            all_emails: r.all.join("; "),
            email_scraped_at: now,
          })
          .eq("id", row.id as string);
      } catch {
        /* تجاهل */
      } finally {
        processed++;
      }
    });

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      action: "scrape_emails",
      details: { jobId: data.jobId, processed, withEmail },
    });

    return { processed, withEmail, total: targets.length };
  });
