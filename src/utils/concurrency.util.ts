/**
 * Concurrency utility for limiting parallel operations
 * Performance optimization: Prevents overwhelming systems with too many concurrent operations
 */

/**
 * Execute promises with a concurrency limit
 * @param tasks Array of functions that return promises
 * @param limit Maximum number of concurrent executions
 * @returns Promise that resolves when all tasks complete
 */
export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = (async () => {
      try {
        const result = await task();
        results.push({ success: true, result });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    })();

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

