/** GHSA-p4f5-76q4-ffq7: block affected Vite 8 development servers. */
export function assertPatchedVite(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor, patch] = match ? match.slice(1).map(Number) : [];
  const safe =
    major === 8 &&
    ((minor === 1 && patch >= 7) ||
      (minor === 2 && patch >= 5) ||
      (minor === 3 && patch >= 7) ||
      minor > 3);
  if (!safe) {
    throw new Error(
      "Vite " +
        version +
        " is not an approved patched development server. " +
        "Run corepack pnpm install to install Vite 8.3.7+ and its patched Rolldown dependency.",
    );
  }
}
