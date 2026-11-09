// Starts the background send scheduler when the Next.js server boots.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler/runner");
    startScheduler();
  }
}
