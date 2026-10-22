# [NOME DA BET] — DEMO de apostas (créditos fictícios)

> **⚠ AMBIENTE DE TESTE: CRÉDITOS FICTÍCIOS SEM VALOR REAL.**
> Este projeto é uma **DEMO**. Não há depósito, saque, pagamento, cashier ou
> qualquer integração financeira real. Os créditos não podem ser comprados,
> trocados ou resgatados. A mesma frase aparece em uma **faixa fixa** em todas
> as telas do site.

Mecânica inicial: **Roleta de Bolas** (inspirada na animação do PES myClub).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 18 + Vite + TypeScript + CSS (animações, sem libs pesadas) |
| Back-end | Node.js + Express + TypeScript |
| Banco | SQLite via Prisma |
| Testes | Vitest + supertest |
| Auth | bcrypt + JWT em cookie `httpOnly` |

## Executar

```bash
npm install     # instala workspaces + cria o SQLite + seed
npm run dev     # API (:4000) + client (:5173) ao mesmo tempo
```

Abra <http://localhost:5173>.

> `npm install` roda o `postinstall` (push do schema + seed). Se pular as
> dependências de script, rode `npm run db:setup -w server`.

### Contas de teste (seed)

| Papel | E-mail | Senha |
| --- | --- | --- |
| admin | `admin@bet.demo` | `admin1234` |
| jogador | `jogador@bet.demo` | `jogador1234` |

Novas contas recebem **1.000 créditos fictícios**. O botão *"Recarregar
créditos de teste"* (lobby) devolve o saldo a 1.000.

## Outros comandos

```bash
npm test                                   # testes obrigatórios do servidor (Vitest)
npm run test:client                        # testes do client
npm run simulate -- --rounds 10000000      # simulação de RTP (relatório abaixo)
npm run build                              # build de client + server
npm run typecheck -w server -w client      # checagem de tipos
```

## Estrutura de pastas

```
/shared    tipos e constantes comuns (bolas, valores em centésimos, DTOs)
/server
  ├── prisma/            schema + seed
  └── src/
      ├── games/
      │   ├── registry.ts          ← lobby de jogos
      │   └── ball-roulette/       ← módulo isolado do jogo
      │       ├── draw.ts            sorteio crypto.randomInt
      │       ├── rtp.ts             computeRTP(config)
      │       ├── config-validation  soma das probabilidades = 10.000
      │       ├── round-resolver.ts  regras puras (bronze/grátis)
      │       ├── engine.ts          motor transacional + idempotência
      │       ├── simulation.ts      simulador de milhões de rodadas
      │       └── index.ts
      ├── services/      auth, config (versionada), rounds
      ├── middleware/    auth JWT, rate limit, erros
      ├── routes/        auth, roulette, history, admin, misc
      └── scripts/       simulate.ts
/client
  └── src/
      ├── pages/         AuthPage, LobbyPage, RoulettePage, HistoryPage, AdminPage
      ├── components/    DemoBanner (faixa fixa), TopBar, RouletteWheel
      ├── auth.tsx       contexto de sessão/saldo (saldo SEMPRE da API)
      ├── api.ts         cliente HTTP
      └── sound.ts       efeitos sonoros sintetizados (Web Audio)
/docs
  ├── simulation-report.md   relatório da simulação de 10M de rodadas
  └── adding-a-game.md       como adicionar um novo jogo ao lobby
```

## Páginas

- **Entrar / Criar conta** — e-mail + senha (bcrypt), sessão JWT em cookie
  httpOnly; registro dá 1.000 créditos fictícios.
- **Lobby** — saldo no topo, card da Roleta de Bolas ativa, cards "Em breve"
  para os demais jogos, botão *"Recarregar créditos de teste"*.
- **Roleta de Bolas** — campo de aposta com atalhos (mín, ½, 2x, máx), botão
  GIRAR, legenda das 5 bolas com probabilidade/multiplicador, último
  resultado, últimas 10 rodadas, regras + RTP teórico. Animação: bolas em
  círculo aceleram e desaceleram até parar na bola sorteada; vencedora com
  brilho e partículas; **bola preta** com flash + tremor + "10x"; **bronze**
  mostra "Tentativa grátis!" e gira de novo sem débito. Botão desabilitado
  durante toda a animação. Opções: *reduzir animações* e *som*.
- **Histórico** — lista paginada de todas as rodadas (aposta, bola,
  multiplicador, retorno, saldo antes/depois).
- **Admin** (papel `admin`) — editor de probabilidades/multiplicadores com
  **prévia do RTP e da banca antes de confirmar**, histórico de versões (data
  + autor), cards de métricas (total apostado/pago, RTP real, lucro da banca,
  rodadas, distribuição de bolas) e lista de usuários com reset de saldo.

## Regras da Roleta de Bolas

Multiplicador = **retorno total da rodada** (já inclui a aposta):

| Bola | Multiplicador | Significado |
| --- | --- | --- |
| Branca | 0x | perde a aposta |
| Bronze | — | 1 tentativa grátis (não debita; **não encadeia** novas grátis) |
| Prata | 1,5x | |
| Dourada | 2x | |
| Preta | 10x | animação especial |

Na tentativa grátis: prata/dourada/preta pagam `multiplicador × aposta
original` (nada foi debitado); branca/bronze pagam 0 e encerram a sequência.

Probabilidades iniciais: branca 62%, bronze 10%, prata 18%, dourada 8%,
preta 2% (guardadas em partes por 10.000; a soma **deve** ser exatamente
10.000, senão a configuração é rejeitada).

### Integridade

- `POST /api/roulette/spin`: valida sessão/saldo/limites e executa
  **uma transação atômica** (débito → sorteio → crédito → gravação do `Round`
  com `balanceBefore/balanceAfter`); bronze roda a tentativa grátis na mesma
  transação e devolve as duas etapas.
- **Idempotência**: a mesma `idempotencyKey` nunca processa duas vezes
  (constraint única + checagem na transação; requisições simultâneas são
  serializadas). Resposta repetida vem com `replayed: true`.
- **Saldo nunca negativo** (checagem condicional no `UPDATE`).
- Sorteio com `crypto.randomInt` — **`Math.random` é proibido** no servidor.
- O resultado é definido **antes** da animação; o cliente só exibe. O cliente
  nunca envia, calcula nem influencia saldo/resultado.
- Zod em toda entrada, rate limit no `/spin`, CORS restrito, senhas bcrypt,
  log de auditoria de cada rodada.

## RTP (seção 6)

```
E     = p_prata×1,5 + p_dourada×2 + p_preta×10
RTP   = E × (1 + p_bronze)
Banca = 1 − RTP
```

Com as probabilidades iniciais: `E = 0,63` → **RTP = 69,3%** → banca = 30,7%.
Exibido no painel admin e na tela de regras; ao salvar nova configuração o
admin vê a prévia antes de confirmar. A configuração é **global** — igual
para todos os jogadores, sem variação por usuário ou histórico.

### Simulação

```bash
npm run simulate -- --rounds 10000000
```

Usa o mesmo código de sorteio e imprime RTP medido, frequência de cada bola,
maior sequência de perdas, desvio padrão e comparação com o teórico. Um teste
automatizado **falha** se o RTP medido divergir do teórico além de
`RTP_TOLERANCE` (padrão 1 p.p.).

**Resultado (10M de rodadas)** — ver [docs/simulation-report.md](docs/simulation-report.md):
RTP teórico **69,3000%** vs medido **69,2962%** (Δ = 0,0038 p.p., tolerância
1 p.p. ✅).

## Testes obrigatórios (`npm test`)

- saldo nunca negativo; aposta maior que o saldo rejeitada;
- bronze não debita e não encadeia nova tentativa grátis;
- cada multiplicador calculado corretamente (aposta 100 + dourada = retorno
  200, ganho líquido 100);
- mesma `idempotencyKey` processa uma única vez; requisições simultâneas não
  geram cobrança duplicada;
- soma das probabilidades = 100% (config inválida é rejeitada);
- resultado exibido = resultado gravado no banco;
- simulação de milhões de rodadas dentro da tolerância do RTP;
- segurança: rotas privadas sem sessão → 401, admin exige papel, CORS
  restrito, validação de entrada.

## Adicionar um novo jogo

Guia completo em [docs/adding-a-game.md](docs/adding-a-game.md). Resumo:
crie `server/src/games/<novo-jogo>/` (copiando o padrão de
`ball-roulette/`), registre em `registry.ts`, monte a rota em `app.ts`, crie
a página no client. O restante da API não muda.

## Segurança / escopo da demo

- Este é um **ambiente de teste**. Não coloque dados reais. O `JWT_SECRET`
  padrão é de desenvolvimento — troque em `.env` se for expor o serviço.
- Sem GDPR/KYC/pagamentos: fora do escopo por ser uma demo de créditos
  fictícios.
