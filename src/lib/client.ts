// Browser-side helper for calling our JSON API.
export async function api(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    return {
      ok: false,
      data,
      error:
        (data.error as string) ??
        (data.message as string) ??
        "Something went wrong",
    };
  } catch {
    return { ok: false, data: {}, error: "Could not reach the server" };
  }
}
