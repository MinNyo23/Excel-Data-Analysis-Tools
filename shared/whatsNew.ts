import { APP_VERSION } from "./appVersion";

export type ReleaseNotes = {
  version: string;
  items: string[];
};

/** Newest first. Keep in sync with APP_VERSION for the login “What’s new” panel. */
export const RELEASE_NOTES: ReleaseNotes[] = [
  {
    version: "1.0.2",
    items: [
      "Large-file runs now show Reading files, Matching records, and Building Excel instead of a spinner only.",
      "Master Account lists who saved the email domain, who banned whom, and failed login attempts.",
      "What’s new on the login page is tied to the version number (1.0.1 → 1.0.2).",
    ],
  },
  {
    version: "1.0.1",
    items: [
      "Email-domain sign-in policy can be saved from Master Account.",
      "The application version is shown on the login page.",
    ],
  },
];

export function notesForVersion(version = APP_VERSION): ReleaseNotes {
  return RELEASE_NOTES.find(entry => entry.version === version) ?? {
    version,
    items: [`Version ${version} is now available.`],
  };
}
