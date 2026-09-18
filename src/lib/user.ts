import { db } from "./db";

export const DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111";
export const DEFAULT_USER_EMAIL = "alex@example.com";

export async function ensureDefaultUser() {
  return await db.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
    },
  });
}
