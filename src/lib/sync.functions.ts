import { createServerFn } from "@tanstack/react-start";
import { runSync } from "./sync.server";

export const triggerSync = createServerFn({ method: "POST" }).handler(async () => {
  return runSync();
});
