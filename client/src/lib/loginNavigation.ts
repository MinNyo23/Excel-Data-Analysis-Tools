import { buildLoginPath, getSafeReturnPath } from "@shared/loginPaths";

const RETURN_PATH_KEY = "excel-master-file-login-return-path";

export function getCurrentReturnPath() {
  if (typeof window === "undefined") return "/";
  return getSafeReturnPath(`${window.location.pathname}${window.location.search}`);
}

export function getLoginPathForCurrentLocation() {
  return buildLoginPath(getCurrentReturnPath());
}

export function saveLoginReturnPath(path: string) {
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, getSafeReturnPath(path));
  } catch {
    // The user can still sign in when session storage is unavailable.
  }
}

export function takeLoginReturnPath() {
  try {
    const value = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return getSafeReturnPath(value);
  } catch {
    return "/";
  }
}
