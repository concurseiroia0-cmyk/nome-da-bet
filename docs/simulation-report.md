# Relatório da simulação — Roleta de Bolas (DEMO)

> **Ambiente de teste: créditos fictícios, sem valor real.** Este relatório usa o
> mesmo código de sorteio (`crypto.randomInt`) e o mesmo resolvedor de rodadas
> (`resolveRound`) do motor transacional usado em produção pela API.

## Como executar

```bash
npm run simulate -- --rounds 10000000
```

O script aceita `--rounds N` e respeita a tolerância configurável em
`RTP_TOLERANCE` (padrão: `0,01` = 1 ponto percentual). O teste automatizado
`server/tests/simulation.test.ts` falha se o RTP medido divergir do teórico
além dessa tolerância.

## Resultado da execução (10.000.000 rodadas)

```
[simulate] config v1 | tolerância=0.01 | minBet=100 maxBet=50000 (centésimos)
================================================================
 SIMULAÇÃO - ROLETA DE BOLAS (DEMO - créditos fictícios)
================================================================
 Rodadas simuladas:      10.000.000
 Duração:                1.29s
 Tentativas grátis:      1.000.421
 Total apostado:         1.000.000.000 centésimos
 Total pago:             692.961.700 centésimos
----------------------------------------------------------------
 RTP teórico:            69.3000%
 RTP medido:             69.2962%
 Diferença (|Δ|):        0.0038%  (tolerância: 1.0000%)
 Dentro da tolerância:   SIM
----------------------------------------------------------------
 Banca teórica:          30.7000%
 Banca medida:           30.7038%
 Retorno líquido médio:  -30.7038% por rodada
 Desvio padrão/rodada:   158.6698%
 Maior sequência de perdas: 43
----------------------------------------------------------------
 Frequência das bolas (rodadas pagas):
   branca   62.0019%
   bronze   10.0042%
   prata    18.0009%
   dourada  7.9942%
   preta    1.9989%
================================================================
```

## Leitura do relatório

| Métrica | Teórico | Medido | Δ |
| --- | --- | --- | --- |
| RTP | 69,30% | 69,2962% | 0,0038 p.p. |
| Banca | 30,70% | 30,7038% | 0,0038 p.p. |
| Branca | 62% | 62,0019% | +0,0019 p.p. |
| Bronze | 10% | 10,0042% | +0,0042 p.p. |
| Prata | 18% | 18,0009% | +0,0009 p.p. |
| Dourada | 8% | 7,9942% | −0,0058 p.p. |
| Preta | 2% | 1,9989% | −0,0011 p.p. |

- **RTP teórico**: `E = 0,18×1,5 + 0,08×2 + 0,02×10 = 0,63`;
  `RTP = E × (1 + p_bronze) = 0,63 × 1,10 = 0,693 = 69,3%`; banca = 30,7%.
- **Frequências**: todas dentro de ±0,006 p.p. do esperado em 10M de amostras.
- **Maior sequência de perdas (43)** é compatível com p = 62% de branca
  (esperado ~40–50 para 10M de tentativas).
- **Desvio padrão/rodada (158,7% da aposta)** confirma a alta variância
  (multiplicadores 10x raros), típica de jogos de sorteio.

## Conclusão

O RTP medido difere do teórico em **0,0038 pontos percentuais**, muito abaixo
da tolerância de 1 p.p., validando o sorteio cumulativo por `crypto.randomInt`
com probabilidades em partes por 10.000.
