import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type SessionNavigationProps = {
  email?: string;
};

export function SessionNavigation({ email }: SessionNavigationProps) {
  if (!email) {
    return (
      <>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Sign up
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
      >
        Dashboard
      </Link>
      <form action={logout}>
        <Button type="submit" variant="outline" size="lg">
          Log out
        </Button>
      </form>
    </>
  );
}
