type PrintpakkeAuthUser = {
  is_anonymous?: boolean | null;
};

/**
 * Printpakker uses the existing distinction between anonymous participant
 * sessions and signed-in teacher accounts. A valid user object alone is not
 * enough because students can have an anonymous Supabase session.
 */
export function hasPrintpakkeDownloadSession(user: PrintpakkeAuthUser | null | undefined) {
  return Boolean(user && !user.is_anonymous);
}
