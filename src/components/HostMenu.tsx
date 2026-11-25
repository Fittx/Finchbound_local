import { useState } from "react";
import { useSession } from "../api/session";
import { LogoutModal } from "./LogoutModal";
import { ProfileMenu } from "./ProfileMenu";

/** Account menu with Account, Admin (for admins) and Sign out, for any signed-in screen. */
export function HostMenu() {
  const session = useSession();
  const [logout, setLogout] = useState(false);
  return (
    <>
      <ProfileMenu name={session?.name ?? "Account"} onSignOut={() => setLogout(true)} />
      <LogoutModal open={logout} onClose={() => setLogout(false)} />
    </>
  );
}
