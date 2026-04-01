import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const WEEKEND_PASS_AMOUNT = 9_900;
const EVENT_PASS_AMOUNT = 49_900;
const WEEKEND_PASS_PRICE_ID = "price_1T9B9BFezSVmwrOXmJX9Qw1L";
const EVENT_PASS_PRICE_ID = "price_1T9BJsFezSVmwrOXlaklvAzQ";

type LegacyPlanType = "weekend" | "event";
type ProfilePlanType = LegacyPlanType | "free" | "pro" | "school";
type ProfileLookupRow = {
  id: string;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

function getAccessExpiry(planType: LegacyPlanType): string {
  const now = new Date();

  if (planType === "weekend") {
    now.setHours(now.getHours() + 48);
    return now.toISOString();
  }

  now.setDate(now.getDate() + 7);
  return now.toISOString();
}

function resolvePlanFromAmount(amountTotal: number | null): LegacyPlanType | null {
  if (amountTotal === WEEKEND_PASS_AMOUNT) {
    return "weekend";
  }

  if (amountTotal === EVENT_PASS_AMOUNT) {
    return "event";
  }

  return null;
}

function extractStripeObjectId(
  value:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | null
    | undefined
) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id.trim() || null;
  }

  return null;
}

function toIsoTimestamp(unixSeconds: number | null | undefined) {
  return typeof unixSeconds === "number" && Number.isFinite(unixSeconds)
    ? new Date(unixSeconds * 1000).toISOString()
    : null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  const firstPrice = subscription.items.data[0]?.price;
  return typeof firstPrice?.id === "string" ? firstPrice.id.trim() || null : null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.current_period_end ?? null;
}

function resolvePlanFromPriceId(priceId: string | null): Exclude<ProfilePlanType, "free"> {
  if (!priceId) {
    return "pro";
  }

  if (priceId === WEEKEND_PASS_PRICE_ID) {
    return "weekend";
  }

  if (priceId === EVENT_PASS_PRICE_ID) {
    return "event";
  }

  const normalizedPriceId = priceId.toLocaleLowerCase("da-DK");
  if (
    normalizedPriceId.includes("school") ||
    normalizedPriceId.includes("licens") ||
    normalizedPriceId.includes("license") ||
    normalizedPriceId.includes("enterprise")
  ) {
    return "school";
  }

  return "pro";
}

function buildSubscriptionProfileUpdate(
  subscription: Stripe.Subscription,
  customerId: string | null,
  planType: ProfilePlanType
) {
  const priceId = getSubscriptionPriceId(subscription);
  const currentPeriodEnd = toIsoTimestamp(getSubscriptionCurrentPeriodEnd(subscription));

  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    stripe_current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    plan_type: planType,
    access_expires_at: currentPeriodEnd,
  };
}

async function findProfileIdByStripeSubscription(
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>,
  subscription: Stripe.Subscription
) {
  const subscriptionId = asTrimmedString(subscription.id);

  if (subscriptionId) {
    const { data, error } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle<ProfileLookupRow>();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  const customerId = extractStripeObjectId(subscription.customer);
  if (!customerId) {
    return null;
  }

  const { data, error } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<ProfileLookupRow>();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          asTrimmedString(session.client_reference_id) ||
          asTrimmedString(session.metadata?.userId);

        if (!userId) {
          console.error("Stripe checkout mangler brugerreference.", session.id);
          return NextResponse.json(
            { error: "Betalingen mangler brugerreference." },
            { status: 400 }
          );
        }

        if (session.mode === "subscription") {
          const subscriptionId = extractStripeObjectId(session.subscription);
          if (!subscriptionId) {
            console.error("Stripe subscription checkout mangler subscription.id.", session.id);
            return NextResponse.json(
              { error: "Abonnementet mangler en Stripe subscription-reference." },
              { status: 400 }
            );
          }

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId =
            extractStripeObjectId(session.customer) ??
            extractStripeObjectId(subscription.customer);
          const planType = resolvePlanFromPriceId(getSubscriptionPriceId(subscription));
          const updates = buildSubscriptionProfileUpdate(subscription, customerId, planType);

          const { error } = await adminSupabase.from("profiles").upsert(
            {
              id: userId,
              ...updates,
            },
            {
              onConflict: "id",
            }
          );

          if (error) {
            console.error("Kunne ikke opdatere profiles efter Stripe subscription-checkout:", error);
            return NextResponse.json(
              { error: "Kunne ikke gemme abonnementsadgangen i databasen." },
              { status: 500 }
            );
          }

          break;
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
        const customerId = extractStripeObjectId(session.customer);

        const { error } = await adminSupabase.from("profiles").upsert(
          {
            id: userId,
            stripe_customer_id: customerId,
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

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const profileId = await findProfileIdByStripeSubscription(adminSupabase, subscription);

        if (!profileId) {
          console.warn("Kunne ikke finde profile til Stripe subscription-event.", {
            eventType: event.type,
            subscriptionId: subscription.id,
            customerId: extractStripeObjectId(subscription.customer),
          });
          break;
        }

        const customerId = extractStripeObjectId(subscription.customer);
        const planType =
          event.type === "customer.subscription.deleted"
            ? "free"
            : resolvePlanFromPriceId(getSubscriptionPriceId(subscription));
        const updates = buildSubscriptionProfileUpdate(subscription, customerId, planType);

        const { error } = await adminSupabase
          .from("profiles")
          .update(updates)
          .eq("id", profileId);

        if (error) {
          console.error("Kunne ikke opdatere profiles efter Stripe subscription-event:", error);
          return NextResponse.json(
            { error: "Kunne ikke opdatere abonnementsstatus i databasen." },
            { status: 500 }
          );
        }

        break;
      }

      default:
        break;
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
