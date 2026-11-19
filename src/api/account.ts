import { request } from "./client";
import { setSession, type SessionUser } from "./session";

export const getAccount = () => request<{ user: SessionUser }>("/account");
export async function updateAccount(patch: Pick<SessionUser, "name" | "email">) {
  const result = await request<{ user: SessionUser }>("/account", "PATCH", patch);
  setSession(result.user);
  return result;
}
export async function changePassword(currentPassword: string, newPassword: string) {
  await request("/account/password", "POST", { currentPassword, newPassword });
  setSession(null);
}
export async function deleteAccount(email: string) {
  await request("/account", "DELETE", { email });
  setSession(null);
}
