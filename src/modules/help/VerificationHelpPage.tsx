import React from "react";
import TopBar from "@/components/shared/TopBar";
import VerifiedBadge from "@/components/VerifiedBadge";

/**
 * Public-facing explanation of what verification means in MoviNesta.
 * Keep this copy very clear to avoid misleading users.
 */
const VerificationHelpPage: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-3">
      <TopBar title="Verification" />

      <div className="mt-4 space-y-6">
        <section className="rounded-3xl border border-border/50 bg-card/70 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">What a verified badge means</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Verification is a trust signal that helps people avoid impersonation. A badge does not
            mean we endorse an account, and it doesn’t guarantee that posts or opinions are
            accurate.
          </p>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card/70 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Badge types</h2>
            <VerifiedBadge isVerified type="identity" label="Example badge" />
          </div>

          <div className="mt-3 space-y-4 text-sm">
            <div>
              <div className="font-semibold text-foreground">Identity verified</div>
              <div className="mt-1 text-muted-foreground">
                We confirmed this account belongs to the real person or organization behind it.
              </div>
            </div>

            <div>
              <div className="font-semibold text-foreground">Official account</div>
              <div className="mt-1 text-muted-foreground">
                This is the official presence of a notable person, brand, or entity.
              </div>
            </div>

            <div>
              <div className="font-semibold text-foreground">Verified by organization</div>
              <div className="mt-1 text-muted-foreground">
                A trusted organization verified this account (for example: a studio, festival, or
                university).
              </div>
            </div>

            <div>
              <div className="font-semibold text-foreground">Subscription badge</div>
              <div className="mt-1 text-muted-foreground">
                This badge indicates a subscription status and eligibility checks. It may not
                include identity review.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card/70 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">How to request verification</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If requests are enabled, go to{" "}
            <span className="font-semibold text-foreground">Settings → Profile → Verification</span>
            and submit evidence links. You can only have one pending request at a time.
          </p>
        </section>
      </div>
    </div>
  );
};

export default VerificationHelpPage;
