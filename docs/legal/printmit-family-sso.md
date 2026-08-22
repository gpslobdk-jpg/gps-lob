# PrintMitArbejdsark Family SSO exchange

SkoleGPS acts as identity provider for the `printmitarbejdsark` audience. The existing short-lived, HMAC-authenticated and single-use backchannel request is authorized by the signed-in SkoleGPS teacher. On atomic consume, SkoleGPS rechecks that the Auth user still exists, is confirmed and is not banned.

The PrintMit strategy returns a short-lived identity payload containing issuer, audience, stable SkoleGPS subject, current verified email, timestamps and the original request reference. It does not generate or return a SkoleGPS magic-link token. PrintMit owns all downstream account mapping, Auth provisioning and session creation in its separate Supabase project.

DagensTavle keeps its existing audience, secret, destination handling and magic-link response. PrintMit uses separate server-only origin and exchange-secret environment variables. No PrintMit service-role credential belongs in SkoleGPS.
