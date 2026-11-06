// Promotes an existing account to super admin.
//
//   npm run make-admin -- you@yourdomain.com
//
// Runs against the database in DATABASE_URL (on Render: the Shell tab of
// the service, after a deploy). Sign up on the site with that email first.
import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { promoteToAdmin } from "../modules/users/admin-bootstrap";

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run make-admin -- <email of an existing account>");
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    const result = await promoteToAdmin(email);
    if (!result.ok) {
      console.error(result.reason);
      process.exitCode = 1;
      return;
    }
    console.log(
      result.alreadyAdmin
        ? `${result.user.name} <${result.user.email}> is already an admin.`
        : `${result.user.name} <${result.user.email}> is now an admin. Sign out and back in to see the admin dashboard.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error("make-admin failed:", err);
  process.exit(1);
});
