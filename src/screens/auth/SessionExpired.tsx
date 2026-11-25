import { AuthLayout } from "../../components/AuthLayout";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { useApp } from "../../store";
import { safeNext } from "../../lib/routing";
import { Button } from "../../ui";

export function SessionExpired() {
  const { navigate, route } = useApp();
  const next = safeNext(route.query.get("next"));
  return (
    <AuthLayout
      title="Your session expired"
      description={`For your security, you're signed out after ${LIMITS.sessionMinutes} minutes unless you choose "Keep me signed in". Sign in again to pick up where you left off.`}
      footer={<TextLink href="/">Go to the homepage</TextLink>}
    >
      <Button size="lg" full onClick={() => navigate("/signin?next=" + encodeURIComponent(next))}>
        Sign in again
      </Button>
    </AuthLayout>
  );
}
