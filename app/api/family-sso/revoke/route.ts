import { NextResponse } from "next/server";

import { isFamilySsoEnabled, isTrustedSkoleGpsRequest } from "@/lib/familySso/config";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const responseHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
  };
  if (!isFamilySsoEnabled()) {
    return NextResponse.json({ ok: true }, { headers: responseHeaders });
  }
  if (!isTrustedSkoleGpsRequest(request)) {
    return NextResponse.json({ ok: false }, { status: 403, headers: responseHeaders });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401, headers: responseHeaders });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503, headers: responseHeaders });
  const { error } = await admin.rpc("revoke_family_sso_requests_for_user", { p_user_id: user.id });
  if (error) {
    return NextResponse.json({ ok: false }, { status: 503, headers: responseHeaders });
  }
  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
