import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const WEEKEND_PASS_AMOUNT = 9_900;
const EVENT_PASS_AMOUNT = 49_900;

type PlanType = "weekend" | "event";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

function getAccessExpiry(planType: PlanType): string {
  const now = new Date();

  if (planType === "weekend") {
    now.setHours(now.getHours() + 48);
    return now.toISOString();
  }

  now.setDate(now.getDate() + 7);
  return now.toISOString();
}

function resolvePlanFromAmount(amountTotal: number | null): PlanType | null {
  if (amountTotal === WEEKEND_PASS_AMOUNT) {
    return "weekend";
  }

  if (amountTotal === EVENT_PASS_AMOUNT) {
    return "event";
  }

  return null;
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    console.error("Stripe webhook mangler STRIPE_SECRET_KEY.");
    return NextResponse.json(
      { error: "Stripe webhook er ikke sat korrekt op." },
      { status: 500 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("Stripe webhook mangler STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json(
      { error: "Stripe webhook er ikke sat korrekt op." },
      { status: 500 }
    );
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    console.error("Stripe webhook mangler Supabase admin-klient.");
    return NextResponse.json(
      { error: "Supabase admin-klienten er ikke sat korrekt op." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Manglende Stripe-signatur." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Ugyldig Stripe-webhook-signatur:", error);
    return NextResponse.json(
      { error: "Webhook-signaturen kunne ikke verificeres." },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId?.trim();

      if (!userId) {
        console.error("Stripe checkout mangler metadata.userId.", session.id);
        return NextResponse.json(
          { error: "Betalingen mangler brugerreference." },
          { status: 400 }
        );
      }

      const planType = resolvePlanFromAmount(session.amount_total ?? null);
      if (!planType) {
        console.error("Stripe checkout har ukendt beløb.", {
          sessionId: session.id,
          amountTotal: session.amount_total,
        });
        return NextResponse.json(
          { error: "Ukendt pakke i Stripe-webhooken." },
          { status: 400 }
        );
      }

      const accessExpiresAt = getAccessExpiry(planType);

      const { error } = await adminSupabase.from("profiles").upsert(
        {
          id: userId,
          plan_type: planType,
          access_expires_at: accessExpiresAt,
        },
        {
          onConflict: "id",
        }
      );

      if (error) {
        console.error("Kunne ikke opdatere profiles efter Stripe-betaling:", error);
        return NextResponse.json(
          { error: "Kunne ikke gemme betalingsadgangen i databasen." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Fejl ved behandling af Stripe-webhook:", error);
    return NextResponse.json(
      { error: "Stripe-webhooken kunne ikke behandles." },
      { status: 500 }
    );
  }
}
