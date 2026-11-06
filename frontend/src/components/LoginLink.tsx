import { Link, useLocation, type LinkProps } from "react-router";

/**
 * A link to /login that remembers the current page, so signing in brings
 * the user straight back (e.g. to the cart they were checking out).
 */
export function LoginLink(props: Omit<LinkProps, "to" | "state">) {
  const location = useLocation();
  return <Link to="/login" state={{ from: location }} {...props} />;
}
