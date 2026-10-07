import { and, eq, lte } from "drizzle-orm";
import { db, scheduledPostsTable } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Publishing simulation: mark scheduled posts as published once they are due,
// even when nobody has the calendar open. Swap for a real queue/worker when
// provider publishing adapters are connected.
setInterval(async () => {
  try {
    await db
      .update(scheduledPostsTable)
      .set({ status: "published" })
      .where(and(eq(scheduledPostsTable.status, "scheduled"), lte(scheduledPostsTable.scheduledAt, new Date())));
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
  }
}, 30_000).unref();
