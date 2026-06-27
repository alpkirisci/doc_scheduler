// Turn any thrown value (Error, Supabase PostgrestError/AuthError plain object,
// string, …) into a useful message — never the dreaded "[object Object]".
export function errorMessage(err: unknown): string {
  if (err == null) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as {
      message?: string;
      error_description?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const base = e.message || e.error_description || e.details;
    if (base) return e.hint ? `${base} — ${e.hint}` : base;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }
  return String(err);
}
