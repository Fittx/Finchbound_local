/** Lazy imports let the application factory stay side-effect free. */
export async function hashPassword(password: string, rounds: number) {
  const { default: bcrypt } = await import("bcrypt");
  return bcrypt.hash(password, rounds);
}
export async function comparePassword(password: string, hash: string) {
  const { default: bcrypt } = await import("bcrypt");
  return bcrypt.compare(password, hash);
}
