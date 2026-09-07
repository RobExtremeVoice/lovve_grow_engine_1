import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";
import { getBrandName } from "@/lib/brand";

const brandName = getBrandName();

export const metadata: Metadata = {
  title: `${brandName} — Terms of Service`,
  description: `Terms for using ${brandName}, private Instagram growth and comment-to-DM software.`,
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      description={`These terms define acceptable use for ${brandName}, a private Instagram growth and comment-to-DM service.`}
      updatedAt="May 24, 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-foreground">Authorized Use</h2>
        <p className="mt-3">
          You may use {brandName} only with Instagram professional accounts you
          own or are authorized to manage. You are responsible for the campaigns,
          keywords, links, and messages you configure.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Platform Compliance</h2>
        <p className="mt-3">
          You agree to follow Meta Platform Terms, Instagram policies, applicable
          messaging rules, privacy laws, advertising rules, and anti-spam laws.
          {" "}{brandName} may rate-limit, pause, or disable campaigns that create
          compliance, abuse, security, or deliverability risk.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Availability</h2>
        <p className="mt-3">
          {brandName} depends on third-party platforms including Meta, email,
          hosting, database, and queue providers. We work to operate the
          service reliably, but uninterrupted availability is not guaranteed.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Software Basis</h2>
        <p className="mt-3">
          {brandName} is built on the MIT-licensed OpenReply project. Operational
          configuration, campaign data, and any additional service features are
          provided by the operator of this instance.
        </p>
      </section>
    </LegalShell>
  );
}
