import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkJoinCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string().max(64).optional() }).parse(input))
  .handler(async ({ data }) => {
    const required = process.env.JOIN_CODE?.trim();
    if (!required) return { ok: true };
    const given = (data.code ?? "").trim();
    if (given.toLowerCase() === required.toLowerCase()) return { ok: true };
    return { ok: false, message: "Ongeldige deelnamecode." };
  });
