import type { User } from "./entities/user.entities";

/**
 * What anyone may see about a user: enough to show a name and avatar next
 * to a review, message, order or booking. This is what a User serializes
 * to by default (see User.toJSON), so an endpoint that returns other people
 * can't leak their email or phone number by accident.
 */
export function publicProfile(user: User) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/** The full account — only for the user themself and for admins. */
export function accountView(user: User) {
  return {
    ...publicProfile(user),
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
  };
}
