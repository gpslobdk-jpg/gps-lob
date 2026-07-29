import "server-only";

import type { User } from "@supabase/supabase-js";

import { hasAdminAppMetadata } from "@/lib/auth/adminClaim";
import { createClient } from "@/utils/supabase/server";

type ValidatedAdminAccess =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

export async function getValidatedAdminAccess(): Promise<ValidatedAdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      message: "Du skal være logget ind.",
    };
  }

  if (!hasAdminAppMetadata(user)) {
    return {
      ok: false,
      status: 403,
      message: "Du har ikke administratoradgang.",
    };
  }

  return {
    ok: true,
    user,
  };
}
