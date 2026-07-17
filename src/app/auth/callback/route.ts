import { type NextRequest, NextResponse } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const mode = request.nextUrl.searchParams.get("mode");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination =
        mode === "recovery"
          ? "/reset-password"
          : `/auth/verified?next=${encodeURIComponent(nextPath)}`;

      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  const failurePath =
    mode === "recovery"
      ? "/forgot-password?error=expired"
      : "/login?error=verification";

  return NextResponse.redirect(new URL(failurePath, request.url));
}
