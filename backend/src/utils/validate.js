import { z } from "zod";

export function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    const err = new Error(message || "Validation error");
    err.statusCode = 400;
    throw err;
  }
  return result.data;
}

export const zId = z.string().min(1);

