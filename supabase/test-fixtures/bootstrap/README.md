# Lokal Supabase-bootstrap

`202603010001_core_schema.sql` er udelukkende en testfixture til en tom, isoleret
lokal Supabase-database. Filen må aldrig anvendes med `--linked`, `db push` eller
mod en hosted database.

Den hostede database er ældre end repositoryets komplette migrationshistorik.
Derfor samler `npm.cmd run test:db:reset-local` bootstrapfilen og de rigtige
produktionsmigrationer i en midlertidig mappe og kører eksplicit `db reset
--local`. Den midlertidige mappe slettes bagefter. Den normale mappe
`supabase/migrations` indeholder dermed kun migrationsfiler, der kan indgå i en
senere kontrolleret deployment.

Bootstrapfilen efterligner desuden Supabase-projektets standardrettigheder for
objekter, der oprettes senere i migrationsforløbet. Det er nødvendigt, fordi den
lokale reset afvikler filerne som `postgres`; RLS-politikkerne er fortsat den
egentlige adgangskontrol.

Kompatibilitet mod et ældre lokalt schema kan testes uden at ændre hosted state:

```powershell
npm.cmd run test:db:reset-local -- --through 202608050001
```
