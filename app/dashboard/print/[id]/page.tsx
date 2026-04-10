import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import StjernelobPdfView from "./StjernelobPdfView";

type Post = {
  number: number;
  title: string;
  body_text: string;
  image_url: string;
  image_prompt: string;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
};

type Stjerneloeb = {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  posts: Post[];
};

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stjerneloeb")
    .select("id, title, subject, grade_level, posts")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const run = data as Stjerneloeb;
  if (Array.isArray(run.posts)) {
    // keep as-is
  } else {
    run.posts = [];
  }

  return <StjernelobPdfView run={run} />;
}
