import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type CheckoutPayload = {
  priceId?: unknown;
  runId?: unknown;
};

const UNAUTHORIZED_MESSAGE = "Du skal v\u00e6re logget ind";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  console.log(
    "CHECKOUT STRIPE KEY PREVIEW:",
    secretKey ? secretKey.slice(0, 5) : "(missing)"
  );

  if (!secretKey) {
    console.error("CHECKOUT STRIPE INIT ERROR: STRIPE_SECRET_KEY is missing.");
    return null;
  }

  return new Stripe(secretKey);
}

export async function POST(req: Request) {
  try {
    const siteUrl = getSiteUrl();
    const successUrl = `${siteUrl}/dashboard?success=true`;
    const cancelUrl = `${siteUrl}/priser?canceled=true`;

    let payload: CheckoutPayload;
    try {
      payload = (await req.json()) as CheckoutPayload;
    } catch (error) {
      console.error("CHECKOUT REQUEST ERROR: Invalid JSON body.", error);
      return NextResponse.json(
        { error: "Checkout-requesten er ugyldig." },
        { status: 400 }
      );
    }

    const priceId = asTrimmedString(payload.priceId);
    const runId = asTrimmedString(payload.runId);

    console.log("CHECKOUT REQUEST:", {
      rawPriceId: payload.priceId,
      priceId,
      runId,
      siteUrl,
      successUrl,
      cancelUrl,
    });

    if (!priceId) {
      console.error("CHECKOUT REQUEST ERROR: Missing priceId in request body.");
      return NextResponse.json(
        { error: "Der mangler en gyldig pris til checkout." },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    console.log(
      "CHECKOUT SUPABASE SERVICE ROLE PREVIEW:",
      serviceRoleKey ? serviceRoleKey.slice(0, 5) : "(missing)"
    );

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      console.error(
        "CHECKOUT SUPABASE INIT WARNING: createAdminClient returned null. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("CHECKOUT AUTH ERROR:", userError);
      return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
    }

    if (!user) {
      console.error("CHECKOUT AUTH ERROR: No authenticated user found in session.");
      return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
    }

    console.log("CHECKOUT AUTH USER:", {
      userId: user.id,
      email: user.email ?? null,
    });

    if (adminSupabase) {
      const { data: adminUserData, error: adminUserError } =
        await adminSupabase.auth.admin.getUserById(user.id);

      if (adminUserError) {
        console.error("CHECKOUT SUPABASE ADMIN ERROR:", adminUserError);
      } else if (!adminUserData.user) {
        console.error("CHECKOUT AUTH ERROR: Session user missing in admin lookup.", {
          userId: user.id,
        });
        return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
      }
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe er ikke sat korrekt op endnu." },
        { status: 500 }
      );
    }

    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId);
      console.log("CHECKOUT STRIPE PRICE OK:", {
        requestedPriceId: priceId,
        stripePriceId: price.id,
        mode: price.recurring ? "subscription" : "payment",
      });
    } catch (error) {
      console.error("CHECKOUT STRIPE PRICE ERROR:", error);
      return NextResponse.json(
        { error: "Den valgte pris kunne ikke findes." },
        { status: 400 }
      );
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: price.recurring ? "subscription" : "payment",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email ?? undefined,
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          ...(runId ? { runId } : {}),
        },
      });
    } catch (error) {
      console.error("CHECKOUT STRIPE SESSION ERROR:", error);
      return NextResponse.json(
        { error: "Kunne ikke oprette betalingssiden lige nu. Proev igen om lidt." },
        { status: 500 }
      );
    }

    if (!session.url) {
      console.error("CHECKOUT STRIPE SESSION ERROR: Stripe returned no session URL.", {
        sessionId: session.id,
        priceId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Kunne ikke oprette betalingslinket lige nu." },
        { status: 500 }
      );
    }

    console.log("CHECKOUT STRIPE SESSION CREATED:", {
      sessionId: session.id,
      priceId,
      userId: user.id,
      successUrl,
      cancelUrl,
      metadataUserId: user.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("CHECKOUT UNHANDLED ERROR:", error);
    return NextResponse.json(
      { error: "Kunne ikke oprette betalingssiden lige nu. Proev igen om lidt." },
      { status: 500 }
    );
  }
}
