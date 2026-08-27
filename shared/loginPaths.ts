export function getSafeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("\\")) return "/";
  return value;
}

export function buildLoginPath(returnPath: string | null | undefined) {
  const safeReturnPath = getSafeReturnPath(returnPath);
  return safeReturnPath === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(safeReturnPath)}`;
}
