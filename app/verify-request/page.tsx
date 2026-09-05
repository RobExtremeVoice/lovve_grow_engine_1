import Link from "next/link";
import { getBrandName } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export const metadata = {
  title: `${getBrandName()} — Check your email`,
  description: "A sign-in link was sent to your email.",
};

export default async function VerifyRequestPage() {
  const locale = await getRequestLocale();

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {getBrandName()}
          </h1>
        </div>

        <div className="panel rounded p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">
            {t("checkEmailHeading", locale)}
          </h2>
          <p className="text-sm text-muted">{t("checkEmailBody", locale)}</p>
          <p className="mt-6 text-sm">
            <Link href="/login" className="text-accent hover:underline">
              {t("backToSignIn", locale)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
