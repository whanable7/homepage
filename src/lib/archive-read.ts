const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function retryArchiveRead<T>(
  read: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = pause,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      const temporary =
        error instanceof Error &&
        (/Failed to fetch blob: (429|5\d\d)\b/.test(error.message) ||
          /fetch failed|network error|terminated/i.test(error.message) ||
          ["AbortError", "TimeoutError"].includes(error.name));
      if (!temporary || attempt >= 2) throw error;
      await wait(attempt === 0 ? 150 : 450);
    }
  }
}
