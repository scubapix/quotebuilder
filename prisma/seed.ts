import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_CATALOG, DEMO_CUSTOMERS } from "../src/lib/demo-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      connected: false,
      dryRun: true,
      channelId: process.env.BIGCOMMERCE_CHANNEL_ID || "1",
      storeHash: process.env.BIGCOMMERCE_STORE_HASH || null,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
      smtpFrom: process.env.SMTP_FROM || null,
      smtpUser: process.env.SMTP_USER || null,
    },
    create: {
      id: 1,
      connected: false,
      dryRun: true,
      channelId: process.env.BIGCOMMERCE_CHANNEL_ID || "1",
      storeHash: process.env.BIGCOMMERCE_STORE_HASH || null,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
      smtpFrom: process.env.SMTP_FROM || null,
      smtpUser: process.env.SMTP_USER || null,
    },
  });

  for (const product of DEMO_CATALOG) {
    await prisma.catalogItem.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  for (const customer of DEMO_CUSTOMERS) {
    await prisma.customer.upsert({
      where: { bigCommerceId: customer.bigCommerceId },
      update: customer,
      create: customer,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });