import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui";

type Props = Omit<ComponentProps<typeof Input>, "type" | "trailing">;

/** Input with a labeled show/hide control. */
export function PasswordInput(props: Props) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          disabled={props.disabled}
          className="-mr-2 flex min-h-11 items-center gap-2 rounded-sm px-2 t-caption font-medium hover:bg-wash disabled:text-muted"
        >
          {show ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          {show ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
