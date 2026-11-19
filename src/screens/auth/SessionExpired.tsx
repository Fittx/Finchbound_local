import { AuthLayout } from "../../components/AuthLayout";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { useApp } from "../../store";
import { Button } from "../../ui";

export function SessionExpired() {
  const { navigate } = useApp();
  return (
    <AuthLayout
      title="Your session expired"
      description={`For your security, we sign you out after ${LIMITS.sessionMinutes} minutes without activity.`}
      footer={<TextLink href="#/">Go to the homepage</TextLink>}
    >
      <Button size="lg" full onClick={() => navigate("/signin?next=/dashboard")}>
        Sign in again
      </Button>
    </AuthLayout>
  );
}
