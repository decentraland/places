/**
 * Releases an unconsumed native `fetch` Response body so the underlying connection
 * is freed instead of being pinned until GC. Best-effort: it skips bodies that were
 * already read and ignores cancel errors (e.g. an already-closed stream). Use it on
 * discard paths — early returns, throws, or fire-and-forget — where the body would
 * otherwise never be consumed.
 */
export async function drainResponse(response: Response): Promise<void> {
  if (!response.bodyUsed) {
    await response.body?.cancel().catch(() => undefined)
  }
}
