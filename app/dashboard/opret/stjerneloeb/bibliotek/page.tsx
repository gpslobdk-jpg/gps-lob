import LibraryClient from "./LibraryClient";
import { createClient } from "@/utils/supabase/server";

type LibraryRow = {
  id: string;
  file_path: string;
  original_name: string;
  ai_title: string;
  category: string;
  created_at: string;
};

export default async function BibliotekPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("stjerneloeb_library")
    .select("id,file_path,original_name,ai_title,category,created_at")
    .order("created_at", { ascending: false });

  const items: LibraryRow[] = (data ?? []) as LibraryRow[];

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-6 text-white md:px-10">
      <LibraryClient items={items} />
    </main>
  );
}
