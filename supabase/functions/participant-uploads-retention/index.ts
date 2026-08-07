Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "Retired. Use student-data-retention after the private-photo migration.",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  )
);
