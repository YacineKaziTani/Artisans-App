import { AppDataSource } from "../../data-source";
import { User, UserRole } from "./entities/user.entities";

export type PromoteResult =
  | { ok: true; user: Pick<User, "id" | "name" | "email">; alreadyAdmin: boolean }
  | { ok: false; reason: string };

/**
 * Makes an existing account a super admin — how the first admin is created
 * (there's no sign-up path for admins, by design). The account must have
 * been registered normally first, so it has a real password and email.
 * Promoting also counts as confirming the email: an admin did it on purpose.
 */
export async function promoteToAdmin(email: string): Promise<PromoteResult> {
  const repo = AppDataSource.getRepository(User);
  const user = await repo
    .createQueryBuilder("user")
    .where("LOWER(user.email) = :email", { email: email.trim().toLowerCase() })
    .getOne();

  if (!user) {
    return { ok: false, reason: `No account uses ${email}. Sign up on the site first, then run this again.` };
  }
  if (user.deletedAt) return { ok: false, reason: "That account has been deleted." };
  if (!user.isActive) return { ok: false, reason: "That account is suspended — reactivate it first." };

  const alreadyAdmin = user.role === UserRole.SUPER_ADMIN;
  await repo.update(user.id, {
    role: UserRole.SUPER_ADMIN,
    emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
  });
  return { ok: true, user: { id: user.id, name: user.name, email: user.email }, alreadyAdmin };
}
