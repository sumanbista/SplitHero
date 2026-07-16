"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/utils/share-token";
import { createGroupSchema } from "@/lib/validations/group";

const MAX_TOKEN_ATTEMPTS = 3;

export type CreateGroupState = {
  fieldError?: string;
  formError?: string;
  value?: string;
};

export async function createGroup(
  _previousState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const rawName = formData.get("name");
  const validation = createGroupSchema.safeParse({ name: rawName });

  if (!validation.success) {
    return {
      fieldError: validation.error.issues[0]?.message,
      value: typeof rawName === "string" ? rawName : "",
    };
  }

  let shareToken: string | undefined;

  try {
    const supabase = createAdminClient();

    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
      const candidate = generateShareToken();
      const { error } = await supabase.from("groups").insert({
        name: validation.data.name,
        share_token: candidate,
      });

      if (!error) {
        shareToken = candidate;
        break;
      }

      if (error.code !== "23505") {
        return {
          formError: "We couldn’t create your group. Please try again.",
          value: validation.data.name,
        };
      }
    }
  } catch {
    return {
      formError: "We couldn’t create your group. Please try again.",
      value: validation.data.name,
    };
  }

  if (!shareToken) {
    return {
      formError: "We couldn’t create a unique group link. Please try again.",
      value: validation.data.name,
    };
  }

  redirect(`/groups/${shareToken}`);
}
