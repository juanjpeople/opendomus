import { api } from "@/lib/cloud/api";

export type SocialProvider = "google" | "github";
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["google", "github"];

export function authorizationUrl(provider: SocialProvider, value: string): string {
  const url = new URL(value);
  const valid = provider === "google"
    ? url.hostname === "accounts.google.com" && url.pathname.startsWith("/o/oauth2/")
    : url.hostname === "github.com" && url.pathname === "/login/oauth/authorize";
  if (!valid || url.protocol !== "https:" || url.port || url.username || url.password || url.hash) throw new Error("invalid-oauth-destination");
  return url.href;
}

export async function startSocial(provider: SocialProvider, mode: "signin" | "link", origin: string) {
  const callbackURL = new URL(mode === "link" ? "/ajustes" : "/cuenta?modo=entrar&social=1", origin).href;
  const response = await api<{ url: string }>("POST", mode === "link" ? "/auth/link-social" : "/auth/sign-in/social", {
    provider, callbackURL, errorCallbackURL: new URL("/cuenta?modo=entrar&socialError=1", origin).href, disableRedirect: true,
  });
  return authorizationUrl(provider, response.url);
}

export async function socialAvailability(): Promise<SocialProvider[]> {
  const result = await api<{ providers: unknown[] }>("GET", "/social-providers");
  return SOCIAL_PROVIDERS.filter((provider) => result.providers.includes(provider));
}

export async function linkedSocialProviders(): Promise<SocialProvider[]> {
  const accounts = await api<{ providerId: string }[]>("GET", "/auth/list-accounts");
  return SOCIAL_PROVIDERS.filter((provider) => accounts.some((account) => account.providerId === provider));
}
