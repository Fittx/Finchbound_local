import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./ApiError.js";
const payload = z.strictObject({
  scope: z.string(),
  id: z.string().regex(/^[a-f0-9]{24}$/),
  key: z.union([z.number().finite(), z.string().datetime()]),
});
export type Cursor = z.infer<typeof payload>;
export class CursorCodec {
  constructor(private readonly secret: string) {}
  private signature(data: string) {
    return createHmac("sha256", this.secret)
      .update("finchbound:cursor:v1:" + data)
      .digest();
  }
  encode(value: Cursor) {
    const data = Buffer.from(JSON.stringify(value)).toString("base64url");
    return data + "." + this.signature(data).toString("base64url");
  }
  decode(value: string | undefined, scope: string): Cursor | undefined {
    if (!value) return undefined;
    try {
      const parts = value.split(".");
      if (parts.length !== 2) throw new Error();
      const [data, signature] = parts as [string, string];
      const actual = Buffer.from(signature, "base64url"),
        expected = this.signature(data);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        throw new Error();
      const parsed = payload.parse(JSON.parse(Buffer.from(data, "base64url").toString("utf8")));
      if (parsed.scope !== scope) throw new Error();
      return parsed;
    } catch {
      throw new ApiError("VALIDATION_FAILED", "This cursor does not match the list. Reload it.", {
        cursor: "Use the cursor returned by this list",
      });
    }
  }
}
