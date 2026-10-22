# Como adicionar um novo jogo ao lobby

Guia passo a passo para incluir uma nova mecânica (ex.: slot **"Tigrinho"**)
sem tocar no restante da API. A Roleta de Bolas vive isolada em
`server/src/games/ball-roulette/`; novos jogos seguem o mesmo padrão.

## Estrutura atual

```
server/src/games/
├── registry.ts            ← registro único de jogos do lobby
└── ball-roulette/
    ├── draw.ts             ← sorteio (crypto.randomInt)
    ├── rtp.ts              ← computeRTP(config)
    ├── config-validation.ts← validateGameConfig (soma = 100%)
    ├── round-resolver.ts   ← resolveRound (regras puras)
    ├── engine.ts           ← motor transacional (débito→sorteio→crédito)
    ├── simulation.ts       ← simulador de milhões de rodadas
    └── index.ts            ← exportações públicas do módulo
```

## Passo a passo

### 1. Crie a pasta do módulo

```
server/src/games/tigrinho/
  draw.ts             # sorteio com crypto.randomInt (NUNCA Math.random)
  rtp.ts              # computeRTP(config) do novo jogo
  config-validation.ts
  round-resolver.ts   # regras puras, testáveis sem banco
  engine.ts           # transação única: débito → sorteio → crédito → Round
  simulation.ts       # simulador reutilizando draw/round-resolver
  index.ts            # export * de tudo acima
```

Copie a estrutura de `ball-roulette/` como referência: ela já resolve
idempotência (constraint única de `idempotencyKey`), saldo não-negativo
(UPDATE condicional) e persistência de `Round` na mesma transação.

### 2. Registre o jogo no lobby

Edite `server/src/games/registry.ts` e adicione a entrada com
`status: 'available'`:

```ts
{
  id: 'tigrinho',
  name: 'Tigrinho',
  description: 'Slot clássico — créditos fictícios.',
  status: 'available',
}
```

O `GET /api/lobby` e o card do lobby passam a mostrar o jogo automaticamente.

### 3. Registre as rotas da API

Em `server/src/app.ts`, monte o router do novo jogo (crie
`src/routes/tigrinho.routes.ts` no mesmo padrão das demais):

```ts
app.use('/api/tigrinho', tigrinhoRoutes);
```

Regras obrigatórias de segurança que já vêm prontas nos middlewares:

- `requireAuth` para qualquer rota com saldo;
- `zod` validando corpo/consulta;
- `createRateLimiter` no endpoint de aposta;
- `audit(...)` gravando cada rodada;
- motor transacional do módulo (nunca saldo fora de transação).

### 4. Modele os dados

Se o jogo precisa de tabelas próprias, adicione os models em
`server/prisma/schema.prisma` (padrão: `Round` com `bet`, `payout`,
`balanceBefore`, `balanceAfter`, `idempotencyKey` única, `rngSeed/nonce`) e
rode `npm run db:push -w server`.

Para configuração versionada como a roleta, reutilize `GameConfig` com um
campo `gameId` ou crie `TigrinhoConfig` seguindo o histórico de versões
(data + autor).

### 5. RTP e simulação

Implemente `computeRTP(config)` puro no módulo e o script de simulação
reutilizando o **mesmo** código de sorteio. Adicione um teste que falha se o
RTP medido divergir do teórico além de `RTP_TOLERANCE`.

### 6. Front-end

- Crie `client/src/pages/TigrinhoPage.tsx` com a página do jogo;
- adicione a rota em `client/src/App.tsx` dentro de `<RequireAuth>`;
- no card do lobby (`LobbyPage.tsx`), troque o estado `"Em breve"` por um
  `<Link to="/tigrinho">` — os cards vêm do `GET /api/lobby`, então basta o
  registro do passo 2 mudar `status` para `available`.

### 7. Testes

Crie `server/tests/tigrinho*.test.ts` cobrindo pelo menos:

- saldo nunca negativo / aposta maior que o saldo rejeitada;
- pagamentos corretos por resultado;
- idempotência (mesma key = 1 cobrança; concorrência sem cobrança dupla);
- validação da configuração;
- resultado exibido = resultado gravado;
- simulação dentro da tolerância de RTP.

Rode `npm test` na raiz (server) e `npm run test:client`.

## Checklist final

- [ ] Módulo isolado em `src/games/<jogo>/` (sem tocar em ball-roulette)
- [ ] Entrada no `registry.ts` com `status: 'available'`
- [ ] Rotas montadas em `app.ts` com `requireAuth` + rate limit + zod + audit
- [ ] Sorteio com `crypto.randomInt` (Math.random proibido)
- [ ] `computeRTP` + simulação + teste de tolerância
- [ ] Página no client + rota no `App.tsx`
- [ ] Testes obrigatórios passando em `npm test`
- [ ] Faixa "Ambiente de teste, créditos fictícios sem valor real" visível
      (ela é global no layout — nada a fazer)
