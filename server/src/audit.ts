/**
 * Log de auditoria em JSON por linha (stdout).
 * Cada rodada, login, registro e alteração de configuração gera um evento.
 */
export function audit(action: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), audit: action, ...data });
  console.log(line);
}
