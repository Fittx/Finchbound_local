import { Home } from "lucide-react";
import { FeatherMark } from "../../brand";
import { useApp } from "../../store";
import { Button } from "../../ui";

/**
 * Reader failure card. "private" covers unpublished books and books set to Only me;
 * "not-found" covers unknown links. Both lead back home so there is no dead end.
 */
export function ReaderError({ kind }: { kind: "private" | "not-found" }) {
  const { navigate } = useApp();
  return (
    <div role="alert" className="flex h-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-linen p-8 text-center shadow-e2">
        <FeatherMark className="size-10" color="#E63946" />
        <h1 className="t-h2">
          {kind === "private" ? "This book isn't available" : "We couldn't find this book"}
        </h1>
        <p className="t-body">The link may be mistyped, or the host made it private.</p>
        <Button icon={<Home className="size-5" aria-hidden="true" />} onClick={() => navigate("/")}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
