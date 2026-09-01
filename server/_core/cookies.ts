const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type SessionCookieOptions = {
  domain?: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
};

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: any) {
  if (req?.protocol === "https") return true;

  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList: string[] = Array.isArray(forwardedProto)
    ? forwardedProto.map(String)
    : String(forwardedProto).split(",");

  return protoList.some((proto: string) => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(req: any): SessionCookieOptions {
  // Session cookies intentionally do not set a domain. This keeps them scoped
  // to the active Vercel deployment and avoids cross-environment leakage.
  void LOCAL_HOSTS;
  void isIpAddress;

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
