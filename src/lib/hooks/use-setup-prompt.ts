import { useState } from 'react';
import { shouldPromptSetup, type SetupProblem } from '../domain/setup';

/**
 * Remembers which setup problem the dialog was last dismissed for. Only that —
 * never a credential. The token lives in GITHUB_TOKEN on the dev server, and
 * nothing a script on the page can read may ever hold it.
 */
export const SETUP_DISMISSED_KEY = 'git-sentinel:setup-dismissed';

/** Storage can throw (private windows, blocked site data); treat that as never dismissed. */
export function readDismissedSetup(): string | null {
  try {
    return localStorage.getItem(SETUP_DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function rememberDismissedSetup(problem: SetupProblem): void {
  try {
    localStorage.setItem(SETUP_DISMISSED_KEY, problem);
  } catch {
    // Unable to remember: the dialog shows again next session, which is harmless.
  }
}

export interface SetupPrompt {
  open: boolean;
  dismiss: () => void;
  /** Show the dialog again, e.g. from the sample-data banner. */
  reopen: () => void;
}

/** Opens the setup dialog the first time each problem is seen, until it is dismissed. */
export function useSetupPrompt(problem: SetupProblem | null): SetupPrompt {
  const [dismissed, setDismissed] = useState(readDismissedSetup);
  const [reopened, setReopened] = useState(false);

  return {
    open: problem !== null && (reopened || shouldPromptSetup(problem, dismissed)),
    dismiss: () => {
      if (problem) {
        rememberDismissedSetup(problem);
        setDismissed(problem);
      }
      setReopened(false);
    },
    reopen: () => setReopened(true),
  };
}
