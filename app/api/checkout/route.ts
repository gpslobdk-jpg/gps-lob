import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type CheckoutPayload = {
  priceId?: unknown;
  runId?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

export async function POST(req: Request) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) {
      return NextResponse.json(
        { error: "Betalingssiden er ikke sat korrekt op endnu." },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe er ikke sat korrekt op endnu." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Du skal være logget ind for at købe adgang." },
        { status: 401 }
      );
    }

    let payload: CheckoutPayload;
    try {
      payload = (await req.json()) as CheckoutPayload;
    } catch {
      return NextResponse.json(
        { error: "Checkout-requesten er ugyldig." },
        { status: 400 }
      );
    }

    const priceId = asTrimmedString(payload.priceId);
    const runId = asTrimmedString(payload.runId);

    if (!priceId) {
      return NextResponse.json(
        { error: "Der mangler en gyldig pris til checkout." },
        { status: 400 }
      );
    }

    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch {
      return NextResponse.json(
        { error: "Den valgte pris kunne ikke findes." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: price.recurring ? "subscription" : "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard?success=true`,
      cancel_url: `${siteUrl}/priser?canceled=true`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        ...(runId ? { runId } : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Kunne ikke oprette betalingslinket lige nu." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Fejl i checkout:", error);
    return NextResponse.json(
      { error: "Kunne ikke oprette betalingssiden lige nu. Prøv igen om lidt." },
      { status: 500 }
    );
  }
}
