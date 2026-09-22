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

// Goes to another page with a full page load. Use this whenever the signed-in
// user changes (sign in, sign out, join, leave): the header and other layout
// parts are rendered on the server from the session, and a client-side
// router.push followed by router.refresh() can race, leaving the page blank on
// the old URL (seen in the Docker build, not in local runs).
export function navigateTo(path: string) {
  window.location.assign(path);
}

// Scrolls to the Assign panel on the Budget page and focuses its first field.
export function focusAssignPanel() {
  const el = document.getElementById("assign");
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.querySelector<HTMLElement>("select, input, button")?.focus({
    preventScroll: true,
  });
}
