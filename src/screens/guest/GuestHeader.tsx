import { ArrowLeft } from "lucide-react";
import { useApp } from "../../store";
import { Button } from "../../ui";

export function GuestHeader({ back, step }: { back: string; step?: string }) {
  const { navigate } = useApp();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Button
        variant="inverse"
        className="px-3 shadow-e1"
        icon={<ArrowLeft className="size-5" aria-hidden="true" />}
        onClick={() => navigate(back)}
      >
        Back
      </Button>
      {step && <span className="t-caption font-medium">{step}</span>}
    </div>
  );
}
