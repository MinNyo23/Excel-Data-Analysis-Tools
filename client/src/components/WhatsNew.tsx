import { useState } from "react";
import { Sparkles } from "lucide-react";
import { APP_VERSION } from "@shared/appVersion";
import { notesForVersion } from "@shared/whatsNew";

export const WHATS_NEW_SEEN_KEY = "excel-whats-new-seen";

function readSeenVersion() {
  try {
    return window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(version: string) {
  try {
    window.localStorage.setItem(WHATS_NEW_SEEN_KEY, version);
  } catch {
    /* private mode */
  }
}

export function WhatsNewOnLogin() {
  const notes = notesForVersion(APP_VERSION);
  const [seen, setSeen] = useState(() => readSeenVersion() === APP_VERSION);

  function dismiss() {
    writeSeenVersion(APP_VERSION);
    setSeen(true);
  }

  return (
    <section className={`login-whats-new${seen ? "" : " is-unread"}`} aria-label={`What's new in version ${APP_VERSION}`}>
      <div className="login-whats-new-heading">
        <Sparkles size={15} />
        <strong>What’s new in {APP_VERSION}</strong>
      </div>
      <ul>
        {notes.items.map(item => <li key={item}>{item}</li>)}
      </ul>
      {!seen ? (
        <button type="button" className="login-whats-new-dismiss" onClick={dismiss}>
          Got it
        </button>
      ) : null}
    </section>
  );
}

export function WhatsNewBanner() {
  const notes = notesForVersion(APP_VERSION);
  const [visible, setVisible] = useState(() => readSeenVersion() !== APP_VERSION);
  if (!visible) return null;

  function dismiss() {
    writeSeenVersion(APP_VERSION);
    setVisible(false);
  }

  return (
    <section className="whats-new-banner" aria-label={`What's new in version ${APP_VERSION}`}>
      <div>
        <span className="soft-badge"><Sparkles size={13} /> WHAT’S NEW · {APP_VERSION}</span>
        <ul>
          {notes.items.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <button type="button" onClick={dismiss}>Dismiss</button>
    </section>
  );
}
