import { notFound, redirect } from "next/navigation";

import { getPrintpakke } from "@/lib/printpakker/catalog";
import { hasPrintpakkeDownloadSession } from "@/lib/printpakker/access";
import {
  buildPrintpakkeLoginReturnPath,
  isPrintpakkeDownloadVariant,
} from "@/lib/printpakker/links";
import { createClient } from "@/utils/supabase/server";

type PrintpakkerReturnPageProps = {
  searchParams: Promise<{ download?: string | string[]; slug?: string | string[] }>;
};

/**
 * An authenticated bridge used only after the existing login page has accepted
 * a safe /dashboard return path. It avoids changing auth or Family SSO rules
 * while returning the teacher to the exact package and chosen download.
 */
export default async function PrintpakkerReturnPage({ searchParams }: PrintpakkerReturnPageProps) {
  const query = await searchParams;
  const slug = Array.isArray(query.slug) ? undefined : query.slug;
  const variant = Array.isArray(query.download) ? undefined : query.download;
  const printpakke = slug ? getPrintpakke(slug) : undefined;

  if (!printpakke || !variant || !isPrintpakkeDownloadVariant(variant)) notFound();

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !hasPrintpakkeDownloadSession(user)) {
    redirect(`/login?next=${encodeURIComponent(buildPrintpakkeLoginReturnPath(printpakke.slug, variant))}`);
  }

  redirect(`/printpakker/${printpakke.slug}?download=${encodeURIComponent(variant)}`);
}
