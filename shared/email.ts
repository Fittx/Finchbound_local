/** Personal Gmail accounts only; subdomains and lookalike suffixes are not Gmail. */
export function isGmailAccountEmail(value: string): boolean {
  return /^[^\s@]+@gmail\.com$/i.test(value.trim());
}
export const GMAIL_ACCOUNT_MESSAGE = "Use a Gmail address ending in @gmail.com.";
