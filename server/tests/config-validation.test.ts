/**
 * OBRIGATÓRIO: soma das probabilidades = 100% (config inválida é rejeitada),
 * prévia de RTP antes de confirmar, versionamento da config e estatísticas.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTIPLIERS, DEFAULT_PROBABILITIES } from '@shared';
import { computeRTP, validateGameConfig, validateProbabilities, toRTPPreview } from '../src/games/ball-roulette/index.js';
import { registerAdmin, registerPlayer } from './helpers.js';

describe('validação da configuração de probabilidades', () => {
  it('aceita soma exatamente 10.000 (100%)', () => {
    expect(validateProbabilities(DEFAULT_PROBABILITIES)).toEqual([]);
  });

  it('REJEITA soma diferente de 10.000', () => {
    const invalid = { ...DEFAULT_PROBABILITIES, prata: 1801 }; // 10.001
    const errors = validateProbabilities(invalid);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('10000');
  });

  it('REJEITA soma menor que 100%', () => {
    const invalid = { ...DEFAULT_PROBABILITIES, branca: 6199 }; // 9.999
    expect(validateProbabilities(invalid).length).toBeGreaterThan(0);
  });

  it('REJEITA valores não inteiros, negativos ou bolas desconhecidas', () => {
    expect(validateProbabilities({ ...DEFAULT_PROBABILITIES, prata: 18.5 }).length).toBeGreaterThan(0);
    expect(validateProbabilities({ ...DEFAULT_PROBABILITIES, preta: -1 }).length).toBeGreaterThan(0);
    expect(
      validateProbabilities({ ...DEFAULT_PROBABILITIES, sorte: 100 } as never).length,
    ).toBeGreaterThan(0);
  });

  it('validateGameConfig rejeita branca/bronze com multiplicador editado', () => {
    const errors = validateGameConfig({
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: { ...DEFAULT_MULTIPLIERS, branca: 100 },
      minBet: 100,
      maxBet: 50000,
    });
    expect(errors.some((e) => e.includes('branca'))).toBe(true);
  });

  it('toRTPPreview devolve RTP=69.3% para as configurações iniciais', () => {
    const preview = toRTPPreview(DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS);
    expect(preview.valid).toBe(true);
    expect(preview.rtp).toBeCloseTo(0.693, 10);
    expect(preview.houseEdge).toBeCloseTo(0.307, 10);
  });

  it('toRTPPreview marca como inválida quando a soma não é 100%', () => {
    const preview = toRTPPreview({ ...DEFAULT_PROBABILITIES, bronze: 0 }, DEFAULT_MULTIPLIERS);
    expect(preview.valid).toBe(false);
    expect(preview.rtp).toBeNull();
    expect(preview.errors.length).toBeGreaterThan(0);
  });
});

describe('API de configuração do admin', () => {
  it('não permite salvar configuração com soma ≠ 100% (400)', async () => {
    const admin = await registerAdmin();
    const res = await admin.agent.post('/api/admin/config').send({
      probabilities: { ...DEFAULT_PROBABILITIES, prata: 1700 }, // 9.900
      multipliers: DEFAULT_MULTIPLIERS,
      minBet: 100,
      maxBet: 50000,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_CONFIG');
  });

  it('player não acessa a API admin (403)', async () => {
    const player = await registerPlayer();
    expect((await player.agent.get('/api/admin/config')).status).toBe(403);
  });

  it('preview retorna RTP e banca SEM alterar a configuração vigente', async () => {
    const admin = await registerAdmin();
    const before = await admin.agent.get('/api/admin/config');
    const preview = await admin.agent.post('/api/admin/config/preview').send({
      probabilities: { branca: 5000, bronze: 1000, prata: 2500, dourada: 1300, preta: 200 },
      multipliers: DEFAULT_MULTIPLIERS,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.valid).toBe(true);
    const expected = computeRTP({
      probabilities: { branca: 5000, bronze: 1000, prata: 2500, dourada: 1300, preta: 200 },
      multipliers: DEFAULT_MULTIPLIERS,
    });
    expect(preview.body.rtp).toBeCloseTo(expected.rtp, 10);

    const after = await admin.agent.get('/api/admin/config');
    expect(after.body.current.version).toBe(before.body.current.version);
  });

  it('salvar cria nova VERSÃO com data e autor, e vira a vigente', async () => {
    const admin = await registerAdmin();
    const before = await admin.agent.get('/api/admin/config');
    const nextVersion = before.body.current.version + 1;

    const save = await admin.agent.post('/api/admin/config').send({
      probabilities: { branca: 6000, bronze: 1000, prata: 1900, dourada: 900, preta: 200 },
      multipliers: DEFAULT_MULTIPLIERS,
      minBet: 100,
      maxBet: 50000,
    });
    expect(save.status).toBe(201);
    expect(save.body.current.version).toBe(nextVersion);
    expect(save.body.preview.valid).toBe(true);

    const after = await admin.agent.get('/api/admin/config');
    expect(after.body.current.version).toBe(nextVersion);
    const recorded = after.body.versions.find((v: any) => v.version === nextVersion);
    expect(recorded).toBeTruthy();
    expect(recorded.updatedByEmail).toBe(admin.email); // autor registrado
    expect(new Date(recorded.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('a configuração é GLOBAL: jogadores diferentes leem a MESMA vigente', async () => {
    const a = await registerPlayer();
    const b = await registerPlayer();
    const cfgA = await a.agent.get('/api/roulette/config');
    const cfgB = await b.agent.get('/api/roulette/config');
    expect(cfgA.body.version).toBe(cfgB.body.version);
    expect(cfgA.body.probabilities).toEqual(cfgB.body.probabilities);
  });
});
