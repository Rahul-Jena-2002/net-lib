export const DEFAULT_PORT = 3000;

export function resolvePort(envPort?: string): number {
  const parsed = Number(envPort);
  return !isNaN(parsed) && parsed > 0 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}
