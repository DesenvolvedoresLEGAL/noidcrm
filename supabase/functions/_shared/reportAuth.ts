// Sprint 2.6 — Authorization helper for V2 report edge functions.
import { userClient, serviceClient } from "./reportClient.ts";

export interface AuthSuccess {
  ok: true;
  userId: string;
  organizationId: string;
  canDebug: boolean;
}
export interface AuthFailure {
  ok: false;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "ORG_MISMATCH";
  message: string;
  status: 401 | 403;
}

export async function authorize(
  req: Request,
  requestedOrganizationId: string,
): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Missing or malformed Authorization header",
      status: 401,
    };
  }

  const sbUser = userClient(authHeader);
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await sbUser.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
      status: 401,
    };
  }
  const userId = claimsData.claims.sub as string;

  // Resolve org via the same security-definer helper used everywhere else.
  // deno-lint-ignore no-explicit-any
  const { data: orgIdData, error: orgErr } = await (sbUser as any).rpc(
    "get_user_organization_id",
  );
  if (orgErr) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Could not resolve user organization: ${orgErr.message}`,
      status: 403,
    };
  }
  const userOrgId = orgIdData as string | null;
  if (!userOrgId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "User has no associated organization",
      status: 403,
    };
  }
  if (userOrgId !== requestedOrganizationId) {
    return {
      ok: false,
      code: "ORG_MISMATCH",
      message: "Requested organizationId does not match caller organization",
      status: 403,
    };
  }

  // canDebug = admin role on this org. Use service client to call has_role
  // (it accepts user_id + role and is SECURITY DEFINER).
  let canDebug = false;
  try {
    const sbSvc = serviceClient();
    // deno-lint-ignore no-explicit-any
    const { data: roleData } = await (sbSvc as any).rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    canDebug = roleData === true;
  } catch (_) {
    canDebug = false;
  }

  return {
    ok: true,
    userId,
    organizationId: userOrgId,
    canDebug,
  };
}
