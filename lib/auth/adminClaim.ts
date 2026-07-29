type UserWithAppMetadata = {
  app_metadata?: unknown;
};

export function hasAdminAppMetadata(
  user: UserWithAppMetadata | null | undefined
) {
  const metadata = user?.app_metadata;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "is_admin" in metadata &&
    metadata.is_admin === true
  );
}
