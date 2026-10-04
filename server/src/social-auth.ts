/** Los secretos OAuth pertenecen al Worker. Una configuración incompleta no habilita botones. */
export interface SocialAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export function socialProviders(env: SocialAuthEnv) {
  const credentials = (id?: string, secret?: string) => id?.trim() && secret?.trim()
    ? { clientId: id.trim(), clientSecret: secret.trim() }
    : undefined;
  return {
    google: credentials(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    github: credentials(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  };
}

/** Solo IDs públicos, jamás el objeto que contiene credenciales. */
export function enabledSocialProviders(env: SocialAuthEnv): ("google" | "github")[] {
  const providers = socialProviders(env);
  return (["google", "github"] as const).filter((id) => Boolean(providers[id]));
}
