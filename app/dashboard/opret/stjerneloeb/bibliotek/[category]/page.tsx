import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CategoryGalleryClient from "../CategoryGalleryClient";

const allowed = ["indskoling", "mellemtrin", "udskoling"];

const cardBaseClass =
  "group relative z-0 mx-auto flex h-[12rem] w-full flex-col overflow-hidden rounded-[1rem] border bg-white/6 p-0 text-left shadow-[0_18px_40px_rgba(15,23,42,0.12),0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg transition-all duration-300";

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const category = (params?.category ?? "").toLowerCase();
  if (!allowed.includes(category)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stjerneloeb_library")
    .select("id,file_path,original_name,ai_title,category,created_at")
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not fetch stjerneloeb_library:", error);
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

  const items = (data ?? []).map((row: any) => {
    const filePath = row.file_path as string;
    const publicUrl = filePath && baseUrl ? `${baseUrl}/storage/v1/object/public/stjerneloeb_pdfs/${encodeURIComponent(filePath)}` : null;
    return {
      id: row.id,
      ai_title: row.ai_title ?? row.title ?? "",
      original_name: row.original_name ?? "",
      publicUrl,
      created_at: row.created_at,
      file_path: filePath,
    };
  });

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-6 text-white md:px-10">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 hidden h-full w-full object-cover lg:block"
        src="/bg-loop.mp4"
      />
      <div className="absolute inset-0 z-10 bg-slate-950/70 lg:block" />

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/opret/stjerneloeb/bibliotek" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/6 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10">
            Tilbage til bibliotek
          </Link>
          <h1 className="text-2xl font-black tracking-tight">{category}</h1>
        </div>
      </header>

      <section className="relative z-20 mx-auto mt-8 w-full max-w-6xl">
        <p className="mb-6 text-sm text-white/80">Vælg et materiale eller åbn PDF'en for at se indholdet.</p>

        <CategoryGalleryClient items={items} />
      </section>
    </main>
  );
}
