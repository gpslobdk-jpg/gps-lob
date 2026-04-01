import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type ProfileRow = {
  stripe_customer_id: string | null;
};

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      console.error("Kunne ikke hente Stripe-kunde fra profiles:", profileError);
      return NextResponse.json(
        { error: "Kunne ikke hente abonnementsoplysninger." },
        { status: 500 }
      );
    }

    const customerId =
      typeof profile?.stripe_customer_id === "string" ? profile.stripe_customer_id.trim() : "";

    if (!customerId) {
      return NextResponse.json(
        { error: "Brugeren har ikke en Stripe-kundeprofil." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    if (!stripe) {
      console.error("Stripe portal mangler STRIPE_SECRET_KEY.");
      return NextResponse.json(
        { error: "Stripe er ikke sat korrekt op endnu." },
        { status: 500 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSiteUrl()}/dashboard/indstillinger`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Kunne ikke oprette Stripe Billing Portal-session:", error);
    return NextResponse.json(
      { error: "Kunne ikke åbne abonnementsportalen lige nu." },
      { status: 500 }
    );
  }
}
