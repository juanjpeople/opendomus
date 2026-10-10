/**
 * Verificación en dos pasos de la cuenta: un código de una app autenticadora (TOTP), códigos de
 * respaldo y llaves de acceso (passkeys). Lo arman los plugins de Better Auth; acá están las
 * piezas que los adaptan a Refugiar.
 *
 * Cifrado de extremo a extremo: la contraseña sigue siendo el primer paso, porque de ella sale la
 * clave que abre los datos. Una llave de acceso NO reemplaza la contraseña (no abre nada): solo
 * sirve como segundo paso, en lugar del código. Por eso su "ingreso" exige el desafío pendiente
 * que deja la contraseña, y el ingreso con Google/GitHub también pasa por el segundo paso.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";

/** El mismo nombre que usa el plugin de Better Auth para el desafío pendiente. */
const CHALLENGE_COOKIE = "two_factor";
/** Diez minutos para completar el segundo paso (igual que el plugin). */
const CHALLENGE_MAX_AGE = 600;

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Deja el ingreso a medio camino: sin sesión y con un desafío que se completa en
 * `/two-factor/verify-totp`, `/two-factor/verify-backup-code` o con una llave de acceso.
 */
async function startChallenge(ctx: HookContext, userId: string) {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE, { maxAge: CHALLENGE_MAX_AGE });
  const identifier = `2fa-${generateRandomString(20)}`;
  const expiresAt = new Date(Date.now() + CHALLENGE_MAX_AGE * 1000);
  await ctx.context.internalAdapter.createVerificationValue({ value: userId, identifier, expiresAt });
  await ctx.context.internalAdapter.createVerificationValue({ value: "0", identifier: `2fa-attempts-${identifier}`, expiresAt });
  await ctx.setSignedCookie(cookie.name, identifier, ctx.context.secret, cookie.attributes);
}

/**
 * Lo que el plugin de dos pasos no cubre:
 * - Google/GitHub: el plugin solo frena el ingreso con email. Si la cuenta tiene dos pasos, la
 *   sesión que crea el proveedor se descarta y la app pide el segundo paso (`dos-pasos=1`).
 * - Al apagar los dos pasos se borran las llaves de acceso (solo servían como segundo paso).
 */
export const refugiarTwoFactor = () =>
  ({
    id: "refugiar-two-factor",
    hooks: {
      after: [
        {
          matcher: (context) => context.path?.startsWith("/callback/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession;
            if (!created || !(created.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) return;
            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(created.session.token);
            ctx.context.setNewSession(null);
            await startChallenge(ctx, created.user.id);
            const returned = ctx.context.returned;
            const location = returned instanceof APIError ? new Headers(returned.headers).get("location") : null;
            const target = new URL(location ?? "/cuenta?modo=entrar&social=1", ctx.context.baseURL);
            target.searchParams.set("dos-pasos", "1");
            throw ctx.redirect(target.href);
          }),
        },
        {
          matcher: (context) => context.path === "/two-factor/disable",
          handler: createAuthMiddleware(async (ctx) => {
            const userId = ctx.context.session?.user.id;
            if (!userId || ctx.context.returned instanceof APIError) return;
            await ctx.context.adapter.deleteMany({ model: "passkey", where: [{ field: "userId", value: userId }] });
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;

/**
 * Para `passkey({ authentication: { afterVerification } })`: la llave ya se verificó; ahora tiene
 * que haber un desafío de dos pasos pendiente de ESA persona (o sea, ya puso la contraseña). Si
 * lo hay se consume y el plugin abre la sesión; si no, la llave sola no alcanza.
 */
export async function passkeyAsSecondStep({ ctx, clientData }: { ctx: HookContext; clientData: { id?: unknown } }) {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE);
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  const deny = () => {
    expireCookie(ctx, cookie);
    return APIError.from("UNAUTHORIZED", { code: "TWO_FACTOR_REQUIRED", message: "The password step is required before a passkey" });
  };
  if (!identifier || typeof clientData.id !== "string") throw deny();
  const owner = await ctx.context.adapter.findOne<{ userId: string }>({ model: "passkey", where: [{ field: "credentialID", value: clientData.id }] });
  const challenge = await ctx.context.internalAdapter.consumeVerificationValue(identifier);
  if (!owner || !challenge || challenge.value !== owner.userId || challenge.expiresAt.getTime() < Date.now()) throw deny();
  await ctx.context.internalAdapter.consumeVerificationValue(`2fa-attempts-${identifier}`).catch(() => null);
  expireCookie(ctx, cookie);
}
