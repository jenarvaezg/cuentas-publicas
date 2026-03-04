import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchWithRetry, getFetchRetryEvents, resetFetchRetryEvents } from "../fetch-utils.mjs"

beforeEach(() => {
  resetFetchRetryEvents()
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// Helper: build a minimal ok Response
function okResponse(body = "ok") {
  return { ok: true, status: 200, text: async () => body }
}

// Helper: build a non-ok Response
function errorResponse(status = 500) {
  return { ok: false, status, text: async () => "" }
}

// Run a promise that requires fake timer advancement to resolve/reject.
// Interleaves timer advances with microtask flushes so setTimeout callbacks fire.
async function settle(promise) {
  let done = false
  let result, error
  promise.then(
    (v) => { done = true; result = v },
    (e) => { done = true; error = e },
  )
  while (!done) {
    await vi.runAllTimersAsync()
    // Yield to microtasks
    await Promise.resolve()
  }
  if (error !== undefined) throw error
  return result
}

describe("resetFetchRetryEvents / getFetchRetryEvents", () => {
  it("starts with an empty events list", () => {
    expect(getFetchRetryEvents()).toEqual([])
  })

  it("getFetchRetryEvents returns a copy, not the internal array", async () => {
    vi.spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(okResponse())

    await settle(fetchWithRetry("https://example.com", {}, { maxRetries: 1, timeoutMs: 1000 }))

    const events = getFetchRetryEvents()
    events.push({ fake: true })
    expect(getFetchRetryEvents()).toHaveLength(1)
  })

  it("resetFetchRetryEvents clears all events", async () => {
    vi.spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(okResponse())

    await settle(fetchWithRetry("https://example.com", {}, { maxRetries: 1, timeoutMs: 1000 }))

    expect(getFetchRetryEvents()).toHaveLength(1)
    resetFetchRetryEvents()
    expect(getFetchRetryEvents()).toHaveLength(0)
  })
})

describe("fetchWithRetry — successful fetch", () => {
  it("resolves on first attempt with no retry events", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse())
    const response = await fetchWithRetry("https://example.com")
    expect(response.ok).toBe(true)
    expect(getFetchRetryEvents()).toHaveLength(0)
  })

  it("passes custom options to fetch", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse())
    await fetchWithRetry("https://example.com", { headers: { Authorization: "Bearer token" } })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    )
  })

  it("merges AbortSignal.timeout into the options", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse())
    await fetchWithRetry("https://example.com", {}, { timeoutMs: 5000 })
    expect(AbortSignal.timeout).toHaveBeenCalledWith(5000)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ signal: expect.anything() }),
    )
  })
})

describe("fetchWithRetry — retry on failure then success", () => {
  it("retries after a network error and succeeds on second attempt", async () => {
    vi.spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(okResponse())

    const response = await settle(
      fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 }),
    )

    expect(response.ok).toBe(true)
    const events = getFetchRetryEvents()
    expect(events).toHaveLength(1)
    expect(events[0].attempt).toBe(1)
    expect(events[0].finalFailure).toBe(false)
    expect(events[0].error).toBe("network error")
  })

  it("retries after an HTTP error response and succeeds on second attempt", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse())

    const response = await settle(
      fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 }),
    )

    expect(response.ok).toBe(true)
    const events = getFetchRetryEvents()
    expect(events).toHaveLength(1)
    expect(events[0].error).toContain("HTTP 503")
  })
})

describe("fetchWithRetry — exhausted retries", () => {
  it("throws after exhausting all retries (maxRetries=2, so 3 total attempts)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("persistent error"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow("persistent error")

    const events = getFetchRetryEvents()
    expect(events).toHaveLength(3)
  })

  it("marks only the last event as finalFailure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events[0].finalFailure).toBe(false)
    expect(events[1].finalFailure).toBe(false)
    expect(events[2].finalFailure).toBe(true)
  })

  it("records delayMs=0 for the final failure event", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events[2].delayMs).toBe(0)
  })

  it("throws after exhausting maxRetries=0 (single attempt)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("immediate fail"))

    await expect(
      fetchWithRetry("https://example.com", {}, { maxRetries: 0, timeoutMs: 1000 }),
    ).rejects.toThrow("immediate fail")

    const events = getFetchRetryEvents()
    expect(events).toHaveLength(1)
    expect(events[0].finalFailure).toBe(true)
  })
})

describe("fetchWithRetry — HTTP error responses", () => {
  it("throws an Error with status code in message for non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(errorResponse(404))

    await expect(
      fetchWithRetry("https://example.com/data", {}, { maxRetries: 0 }),
    ).rejects.toThrow("HTTP 404 fetching https://example.com/data")
  })

  it("records the HTTP error message in retry events", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(errorResponse(429))

    await expect(
      fetchWithRetry("https://example.com", {}, { maxRetries: 0 }),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events[0].error).toContain("HTTP 429")
  })
})

describe("fetchWithRetry — retry event structure", () => {
  it("records url, attempt, maxAttempts, delayMs, finalFailure, error, timestamp", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("err"))

    await expect(
      settle(fetchWithRetry("https://example.com/api", {}, { maxRetries: 1, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    const first = events[0]
    expect(first.url).toBe("https://example.com/api")
    expect(first.attempt).toBe(1)
    expect(first.maxAttempts).toBe(2) // maxRetries + 1
    expect(typeof first.delayMs).toBe("number")
    expect(typeof first.finalFailure).toBe("boolean")
    expect(typeof first.error).toBe("string")
    expect(typeof first.timestamp).toBe("string")
    expect(new Date(first.timestamp).toISOString()).toBe(first.timestamp)
  })

  it("records correct attempt numbers across multiple retries", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events.map((e) => e.attempt)).toEqual([1, 2, 3])
    expect(events.map((e) => e.maxAttempts)).toEqual([3, 3, 3])
  })
})

describe("fetchWithRetry — exponential backoff delays", () => {
  it("uses 1000ms delay after first failure and 2000ms after second (2^n backoff)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events[0].delayMs).toBe(1000) // 1000 * 2^0
    expect(events[1].delayMs).toBe(2000) // 1000 * 2^1
  })

  it("records delayMs=0 on final failure (no sleep after last attempt)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(
      settle(fetchWithRetry("https://example.com", {}, { maxRetries: 2, timeoutMs: 1000 })),
    ).rejects.toThrow()

    const events = getFetchRetryEvents()
    expect(events[events.length - 1].delayMs).toBe(0)
  })
})

describe("fetchWithRetry — non-Error rejections", () => {
  it("records String(error) when the thrown value has no message property", async () => {
    // Reject with a plain string, not an Error object
    vi.spyOn(global, "fetch").mockRejectedValueOnce("plain string error")

    await expect(
      fetchWithRetry("https://example.com", {}, { maxRetries: 0 }),
    ).rejects.toBe("plain string error")

    const events = getFetchRetryEvents()
    expect(events[0].error).toBe("plain string error")
  })
})

describe("fetchWithRetry — default parameters", () => {
  it("uses maxRetries=2 by default (3 total attempts on persistent failure)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"))

    await expect(settle(fetchWithRetry("https://example.com"))).rejects.toThrow()

    expect(getFetchRetryEvents()).toHaveLength(3)
  })

  it("uses timeoutMs=30000 by default", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse())
    await fetchWithRetry("https://example.com")
    expect(AbortSignal.timeout).toHaveBeenCalledWith(30000)
  })

  it("resolves with ok response using all defaults", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse())
    const response = await fetchWithRetry("https://example.com")
    expect(response.ok).toBe(true)
  })
})
