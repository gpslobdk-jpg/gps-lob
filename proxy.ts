import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isDashboardPath = (pathname: string) => pathname.startsWith("/dashboard");
const isLoginPath = (pathname: string) => pathname === "/login";

const getSafeNextPath = (request: NextRequest) => {
  const requested = request.nextUrl.searchParams.get("next")?.trim() ?? "";
  return requested.startsWith("/dashboard") ? requested : "/dashboard";
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Hvis vi har en session-cookie men getUser fejler midlertidigt, undgår vi login-loop.
  if (isDashboardPath(request.nextUrl.pathname) && !user && !(session && userError)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPath(request.nextUrl.pathname) && user) {
    return NextResponse.redirect(new URL(getSafeNextPath(request), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
