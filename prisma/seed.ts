import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111";
export const DEFAULT_USER_EMAIL = "alex@example.com";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
    },
  });
  console.log("Default evaluation user initialized:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
