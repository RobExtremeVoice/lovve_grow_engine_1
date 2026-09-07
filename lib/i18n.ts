/**
 * Lightweight EN/PT dictionary for essential operational UI.
 *
 * This is deliberately not a full i18n framework. The Lovve operation runs in
 * English and Portuguese, and a handful of screens (sign-in, invite, the
 * dashboard nav) need both. A plain typed dictionary covers that without
 * touching routing or pulling in a dependency. Later sprints can widen the key
 * set or graduate to a framework if the surface grows.
 *
 * Locale resolution order: an explicit `locale` cookie, then the request's
 * Accept-Language header, then English. Strings with runtime interpolation are
 * intentionally left out for now.
 */

export const LOCALES = ["en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export type MessageKey =
  | "signIn"
  | "signInSubtitle"
  | "workEmailLabel"
  | "emailPlaceholder"
  | "sendMagicLink"
  | "checkEmailHeading"
  | "checkEmailBody"
  | "backToSignIn"
  | "navDashboard"
  | "navOverview"
  | "navInbox"
  | "navCampaigns"
  | "navLogs"
  | "navSettings"
  | "navDiagnostics"
  | "newCampaign"
  | "privateInstanceLabel"
  | "menu"
  | "connect"
  | "connectInstagram"
  | "workspaceInvitation";

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    signIn: "Sign in",
    signInSubtitle:
      "Sign in by email, then connect your Instagram professional account.",
    workEmailLabel: "Work email",
    emailPlaceholder: "you@company.com",
    sendMagicLink: "Email me a magic link",
    checkEmailHeading: "Check your email",
    checkEmailBody:
      "We sent you a secure sign-in link. Open it on this device to continue.",
    backToSignIn: "Back to sign in",
    navDashboard: "Dashboard",
    navOverview: "Overview",
    navInbox: "Inbox",
    navCampaigns: "Campaigns",
    navLogs: "DM Logs",
    navSettings: "Settings",
    navDiagnostics: "Diagnostics",
    newCampaign: "New Campaign",
    privateInstanceLabel: "Private instance",
    menu: "Menu",
    connect: "Connect",
    connectInstagram: "Connect Instagram",
    workspaceInvitation: "Workspace invitation",
  },
  pt: {
    signIn: "Entrar",
    signInSubtitle:
      "Entre pelo e-mail e conecte sua conta profissional do Instagram.",
    workEmailLabel: "E-mail de trabalho",
    emailPlaceholder: "voce@empresa.com",
    sendMagicLink: "Enviar link de acesso por e-mail",
    checkEmailHeading: "Verifique seu e-mail",
    checkEmailBody:
      "Enviamos um link de acesso seguro. Abra-o neste dispositivo para continuar.",
    backToSignIn: "Voltar para o login",
    navDashboard: "Painel",
    navOverview: "Visão geral",
    navInbox: "Caixa de entrada",
    navCampaigns: "Campanhas",
    navLogs: "Registros de DM",
    navSettings: "Configurações",
    navDiagnostics: "Diagnóstico",
    newCampaign: "Nova campanha",
    privateInstanceLabel: "Instância privada",
    menu: "Menu",
    connect: "Conectar",
    connectInstagram: "Conectar Instagram",
    workspaceInvitation: "Convite para workspace",
  },
};

/** Translate a key. Unknown locales fall back to English. */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return (messages[locale] ?? messages[DEFAULT_LOCALE])[key];
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Pick a locale from an explicit cookie value and/or an Accept-Language header.
 * The cookie wins; the header is a fallback; English is the last resort.
 */
export function resolveLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const cookie = input.cookie?.trim().toLowerCase();
  if (cookie && isLocale(cookie)) return cookie;

  const header = input.acceptLanguage?.toLowerCase() ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    const base = tag?.split("-")[0];
    if (base && isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
