import Link from "next/link";

import { AccountMenu } from "@/components/auth/account-menu";
import { buttonVariants } from "@/components/ui/button";
import { getAccountDisplayName } from "@/lib/dashboard/account";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SessionNavigationProps = {
  user?: {
    email?: string;
    id: string;
  } | null;
};

export async function SessionNavigation({ user }: SessionNavigationProps) {
  if (!user) {
    return (
      <>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "min-h-11 sm:min-h-9",
          )}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 sm:min-h-9")}
        >
          Sign up
        </Link>
      </>
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const email = user.email ?? "Email unavailable";
  const displayName = getAccountDisplayName(profile?.display_name, user.email);

  return <AccountMenu displayName={displayName} email={email} />;
}
