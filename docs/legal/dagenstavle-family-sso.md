# Sikker login-overdragelse til DagensTavle

Status: implementeret på feature-branch og beregnet til isoleret test. Funktionen,
migrationen og miljøvariablerne er ikke aktiveret i produktion.

## Dataflow

1. DagensTavle opretter et tilfældigt request-id og en nonce. Browseren gemmer
   dem i en signeret, host-only og HttpOnly DagensTavle-cookie i højst 90
   sekunder.
2. DagensTavles server sender kun SHA-256-hashes, en relativ return-path og
   destinationen til SkoleGPS gennem en tidsbegrænset HMAC-backchannel.
3. Browseren sendes til SkoleGPS med request-id'et. Id'et er kun korrelation og
   kan ikke oprette en session uden den separate nonce-cookie og backchannel-
   hemmeligheden.
4. SkoleGPS kontrollerer den aktuelle lærer-session, profil og kontostatus og
   binder requesten til auth-brugerens stabile id. Verificeret e-mail og
   loginudbyder opbevares kun i den kortlivede request for at etablere samme
   Supabase Auth-identitet.
5. DagensTavles server inspicerer og consumer requesten gennem backchannel.
   Consume er atomisk og single-use. En servergenereret OTP-hash sendes kun i
   den krypterede serverforbindelse og verificeres straks til en ny host-only
   DagensTavle-session.
6. Første brug kræver særskilt accept af DagensTavles aktuelle vilkår. Ved to
   forskellige aktive konti kræves et eksplicit valg.

## Dataminimering og adgangsgrænse

- DagensTavle får ingen Supabase service-role-nøgle og dermed ingen privilegeret
  adgang til SkoleGPS' database.
- Der overføres ikke SkoleGPS-løb, klasser, deltagere, svar, fotos, GPS,
  resultater eller statistik.
- Der anmodes kun om grundlæggende identity scopes: `openid`, `email` og
  `profile`. Gmail, Drive, kalender, Microsoft-filer og postkasser tilgås ikke.
- Browser-URL'er indeholder ingen e-mail, OTP, OAuth-kode, JWT, access token
  eller refresh token. Auth-ruter bruger `no-store`, `no-referrer` og
  `noindex`.
- Kortlivede requests kan ryddes idempotent efter udløb; profiler med
  vilkårsstatus opbevares, mens DagensTavle-kontoen er aktiv, eller indtil en
  verificeret sletteanmodning gennemføres.

## Logout og deaktivering

- Logout i DagensTavle fjerner kun DagensTavles lokale session.
- Logout i SkoleGPS tilbagekalder endnu ikke consumerede, autoriserede requests
  for den bruger, før SkoleGPS-sessionen slettes.
- En consumed, udløbet, annulleret eller tilbagekaldt request kan ikke bruges
  igen.
- Deaktiverede brugere afvises ved både SkoleGPS-kontrollen og den endelige
  server-side exchange.

## Miljøkontrakt uden værdier

SkoleGPS:

- `FAMILY_SSO_ENABLED`
- `DAGENSTAVLE_SSO_ORIGIN`
- `FAMILY_SSO_EXCHANGE_SECRET`
- eksisterende `SUPABASE_SERVICE_ROLE_KEY` kun på SkoleGPS-serveren

DagensTavle:

- `DAGENSTAVLE_FAMILY_SSO_ENABLED`
- `DAGENSTAVLE_ORIGIN`
- `SKOLEGPS_SSO_ORIGIN`
- `SKOLEGPS_SSO_BACKCHANNEL_ORIGIN` (valgfri intern/local serverorigin)
- `FAMILY_SSO_EXCHANGE_SECRET`
- `DAGENSTAVLE_SSO_COOKIE_SECRET`

Secrets skal være separate, tilfældige værdier på mindst 32 bytes, konfigureres
kun server-side og roteres gennem en koordineret deployment. DagensTavle skal
ikke have `SUPABASE_SERVICE_ROLE_KEY`.
