export async function sendDiscordWebhook(message: string): Promise<void> {
  try {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) return;

    // Best-effort send — fail silently so the app never crashes if Discord is down
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    if (!res.ok) {
      // Log but don't throw
      console.error("Discord webhook returned non-OK status:", res.status, await res.text().catch(() => ""));
    }
  } catch (error) {
    // Always swallow errors so calling code remains non-blocking and resilient
    // eslint-disable-next-line no-console
    console.error("Failed to send Discord webhook:", error);
  }
}
