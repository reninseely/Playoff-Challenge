export function usernameToEmail(username: string) {
  const clean = username.trim().toLowerCase();
  return `${clean}@playoff.local`;
}
