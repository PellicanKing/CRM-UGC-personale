// Starts background services when the Next.js server boots.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { markInterruptedSearches } = await import("./lib/leads");
    markInterruptedSearches();
    const { startScheduler } = await import("./lib/scheduler/runner");
    startScheduler();
  }
}
