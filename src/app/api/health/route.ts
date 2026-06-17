import { prisma } from "@/lib/prisma";
import { getAppMode, hasBigCommerceCredentials } from "@/lib/app-mode";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    await prisma.settings.create({ data: { id: 1, connected: false, dryRun: true } });
  }

  const configured = hasBigCommerceCredentials();
  const mode = getAppMode();

  return Response.json({
    ok: true,
    configured,
    needsSetup: !configured,
    dryRun: mode === "dry_run",
    mode,
  });
}
