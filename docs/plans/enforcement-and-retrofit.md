# Piano — enforcement deterministico, revisore pre-PR e retrofit

- **Stato:** concordato, in avvio
- **Data:** 2026-10-05
- **Repo di lavoro:** fork `Lestat86/software-engineering-foundation`
  (upstream `francescocretti/software-engineering-foundation`)
- **Progetto pilota del retrofit:** AntiPhishing-Bot (unico progetto considerato
  per ora)

## Obiettivo

Oggi SEF applica gli standard una sola volta, al bootstrap. Dopo, sono bloccanti
solo gli hook Git (commitlint e lint-staged), ESLint e TypeScript strict;
sicurezza, debito tecnico, eccezioni, test sul codice modificato e
riclassificazione del rischio restano solo scritti. Il piano rende
deterministico tutto ciò che si può esprimere come controllo, affida il resto a
un revisore pre-PR ancorato a criteri oggettivi e aggiunge il retrofit dei
progetti esistenti.

Contesto: due modalità di sviluppo, **assisted** (analisi tra umano e agente,
implementazione dell'agente, review umana della PR) e **autonomous** (anche la
review è automatizzata). Il valore principale sta nell'analisi iniziale, che
quindi deve restare nel repo e fare da criterio per la review.

## Livelli di enforcement

| Livello | Dove sta | Deterministico | Vale per |
| --- | --- | --- | --- |
| **L1** Git hook, ESLint, script in `validate`/`premerge`, CI | Progetto generato | Sì | Persone e qualsiasi agente |
| **L2** Hook di Claude Code | Plugin | Sì | Solo sessioni Claude Code |
| **L3** Skill e subagente revisore | Plugin | No (giudizio del modello) | Chi lo invoca |

Regola: tutto ciò che è esprimibile come controllo va in L1. L2 impedisce
all'agente di aggirare L1. L3 copre solo ciò che richiede giudizio.

## Decisioni

| Tema | Decisione |
| --- | --- |
| Segreti | secretlint (resta nell'ecosistema Yarn). Scansione una tantum della storia git solo nel retrofit |
| Riferimento nei TODO/FIXME | Stile GitLab: `TODO(#123)` |
| Requisiti nel progetto | Copia dei requisiti applicabili in `docs/foundation/`, fissata alla `foundationVersion` |
| Merge bloccato dalla pipeline | Facoltativo (non sempre c'è una pipeline) |
| Comandi pre-merge | `yarn premerge` eseguibile in locale; checkbox "ho lanciato `yarn premerge` su `<sha>`" nel template PR/MR |
| Template PR/MR | GitHub (`.github/`) e GitLab (`.gitlab/merge_request_templates/`) |
| Modalità | Flag `workflow: assisted \| autonomous` in `.engineering-foundation.yml`, override per piano |
| Revisore | Corregge il banale e ciò che rompe i controlli programmatici (in un commit separato; sistema il problema, non il commento di soppressione) e segnala i problemi potenziali |
| Ciclo autonomous | Massimo 3 giri implementatore ↔ revisore, poi l'umano |
| Stryker | Nei template: incrementale sul diff in `premerge`, completo nightly |
| Piani e spec | Una cartella per feature: `docs/features/<slug>/` con `plan.md`, `spec.md` (UI) e screenshot, versionata |
| Preset ESLint, tsconfig, commitlint | SEF li pubblica come pacchetti propri; `@black-bytes/eslint-config` li estende (oggi il generatore li copia nei progetti) |
| Next.js | Escluso per ora |
| Yarn Modern nel retrofit | Obbligatorio: prima PR dell'ondata 0 |
| SonarQube | Rimandato; da rivalutare per la dashboard multi-progetto |

## Comportamento per modalità

| | assisted | autonomous |
| --- | --- | --- |
| Revisore | Corregge il banale, segnala il resto, poi PR all'umano | Ciclo di massimo 3 giri, poi l'umano |
| Stryker sul diff | In `premerge` | In `premerge`, soglia bloccante |
| Configurazioni protette (CODEOWNERS) | Consigliate | Obbligatorie |
| Riassunto nella PR | Sì | Sì, più le decisioni prese in autonomia |

## Mappa dei gap

Cosa non è controllato dopo il bootstrap, e dove va.

| Ambito | L1 (bloccante, nel progetto) | L2 | L3 |
| --- | --- | --- | --- |
| Segreti | secretlint in lint-staged e `validate`; job CI se selezionata | Blocco di `--no-verify` | — |
| Debito tecnico | Regola sui TODO con `#123`; `eslint-comments` con `require-description`; Knip | — | Codice commentato |
| Eccezioni ai MUST | `docs/exceptions.yml` più un validatore in `validate` (campi, ID esistente, scadenza superata → fallisce) | — | Skill `record-exception` |
| Rischio | Validatore del manifest; euristica di avviso (dipendenze di auth o pagamento con R1) | — | Passo del revisore (`SEC-RISK-003`) |
| Validazione input | Test nel template Fastify: ogni route ha uno schema (`onRoute`); Nest con `ValidationPipe` globale | — | Revisore per i confini non HTTP |
| Evidenze ASVS | Controllo di presenza del file del livello | — | Revisore sul contenuto |
| Test sul codice cambiato | Copertura sul diff (compatibile con `TEST-COVERAGE-001`); Stryker sul diff | — | Revisore |
| Commit con un solo scopo | — | — | Revisore |
| Qualità e struttura | `eslint-plugin-sonarjs`, regole di complessità, `react/jsx-no-bind`, dependency-cruiser | — | — |
| Gate completo | `yarn validate` | Hook di fine lavoro se sono cambiati file | — |
| Anti-aggiramento | Soglie che non scendono; zero test instabili | Blocco di `--no-verify` | — |

## Fasi

### Fase 0 — pacchetti condivisi

- Estrarre preset ESLint, tsconfig base e configurazione commitlint in pacchetti
  pubblicati da SEF; il generatore li aggiunge come dipendenze invece di
  copiarli.
- ADR per il cambio di modello di distribuzione (sostituisce in parte ADR 0004).
- **Da decidere:** registry e nome dei pacchetti (npm pubblico con scope, GitHub
  Packages, GitLab Package Registry).

### Fase 1 — L1 nel progetto generato

- secretlint (lint-staged e `validate`).
- Regola sui TODO/FIXME con riferimento `#123`.
- `eslint-comments` con `require-description`.
- `eslint-plugin-sonarjs` e regole di complessità.
- `react/jsx-no-bind` nel profilo React.
- dependency-cruiser (cicli e confini).
- `docs/exceptions.yml` con validatore.
- Validatore di `.engineering-foundation.yml`, con il campo `workflow`.
- Test sugli schemi delle route Fastify.
- Ogni regola è pensata fin da subito per funzionare con una baseline (vedi
  retrofit).

### Fase 1b — `yarn premerge`

- Copertura sul diff, Stryker incrementale, Knip, dependency-cruiser completo.
- Job dei segreti nella CI GitLab facoltativa.
- Template PR/MR GitHub e GitLab con la checkbox legata allo SHA.

### Fase 2 — conoscenza nel progetto

- Copia dei requisiti applicabili in `docs/foundation/`.
- Template di piano e spec in `docs/features/<slug>/` (sotto).
- Validatore del piano in `premerge`: sezioni presenti, "Domande bloccanti"
  vuota, ogni acceptance spuntata oppure marcata manuale o rimandata con issue.

### Fase 3 — plugin Claude Code

- `.claude-plugin/plugin.json` e `marketplace.json`; la skill
  `bootstrap-web-project` resta invariata.
- Skill `record-exception`.
- Subagente revisore pre-PR, con un comando dedicato (es. `/sef:review`):
  1. lancia `yarn validate` e riporta l'esito;
  2. controlla la classificazione del rischio rispetto al diff;
  3. confronta il diff con il piano (acceptance, fuori scope, divergenze senza
     voce in "Aggiornamenti in corsa");
  4. scorre i requisiti di giudizio usando il campo *Verification*.

  Output: Must Fix / Should Fix / Da decidere / Superato, con `file:riga` e ID
  del requisito.
- Hook: gate a fine lavoro, blocco di `--no-verify`.

### Fase 4 — retrofit

Vedi la sezione dedicata. In parallelo alle fasi precedenti: l'ondata 0 si
applica al pilota appena sono pronti gli strumenti della Fase 1; inventario e
controllo della baseline arrivano come script prima del plugin.

## Template del piano (`docs/features/<slug>/plan.md`)

Base: i piani `docs/security-prs/` di isumisura; per la UI, le spec di pagina di
fta-consumer.

```text
---
issue: "#123"
workflow: assisted        # override del flag di progetto, facoltativo
risk-reassessment: no     # sì/no + perché (SEC-RISK-003)
---
Obiettivo
Contesto verificato        # ogni fatto con file:riga; "verificato" vs "assunto"
Decisioni                  # bloccate | da confermare (chi decide)
Fuori scope
Invarianti                 # di dominio + ID dei requisiti SEF toccati
File / piano dei commit
Acceptance                 # [auto: test/lint/grep] | [manuale: chi] | [rimandata: #issue]
Test
Domande bloccanti          # vuota prima di implementare
Aggiornamenti in corsa     # divergenze piano↔codice; il revisore le legge
Descrizione PR
```

Regole:
- Piani e spec stanno in git, mai solo nella memoria personale di un agente; le
  convenzioni di progetto vanno in `AGENTS.md`.
- Una sola fonte per ogni informazione: si linka, non si duplica.
- Ogni guardrail che un piano esprime come grep diventa una regola di lint in
  SEF.

## Retrofit

Il retrofit e l'aggiornamento di versione della foundation sono lo stesso
problema: codice esistente che non rispetta regole nuove.

### Principi

1. Mai tutto in una volta: un piano a ondate di PR piccole, ognuna in
   `docs/features/retrofit-<n>/`.
2. Baseline che può solo scendere: le regole nuove bloccano subito il codice
   nuovo o modificato; l'esistente è congelato in una baseline versionata e
   `premerge` fallisce se cresce.
3. Ogni requisito ha uno stato esplicito: `conforme`, `baseline`, `eccezione`
   (in `exceptions.yml`, con scadenza), `non applicabile`.
4. Le modifiche meccaniche vanno in commit separati (eccezione di
   `GIT-CHANGE-001`).

### Baseline per strumento

| Strumento | Meccanismo |
| --- | --- |
| ESLint | Bulk suppressions di ESLint 9 (`--suppress-all`, `--prune-suppressions`); verificare la versione minima |
| Flag TS più severi | Un workspace alla volta, oppure Betterer (da valutare) |
| dependency-cruiser | File baseline nativo |
| Copertura, Stryker | Già solo sul diff |
| Knip | Configurazione di ignore iniziale, ridotta nel tempo |
| Segreti | Scansione una tantum della storia (es. `gitleaks git`, senza aggiungerlo come dipendenza); un segreto trovato va ruotato (`GIT-SECRET-001`) |

### Flusso (skill `retrofit-project`, modalità assisted)

1. Inventario deterministico: stack, package manager, ESLint, hook, CI, flag di
   tsconfig, test runner, conteggi di soppressioni e TODO, file sospetti
   tracciati.
2. Classificazione del rischio con l'umano (`SEC-RISK-001`).
3. Gap per requisito in `docs/foundation/retrofit-assessment.md`.
4. Piano a ondate:
   - **Ondata 0, rete di sicurezza, senza toccare il codice applicativo:**
     migrazione a Yarn Modern (prima PR), manifest con `workflow`,
     `AGENTS.md`, hook corretti, secretlint con scansione della storia,
     `validate` e `premerge`, template PR/MR. Da qui il revisore è
     utilizzabile.
   - **Ondata 1:** regole ESLint SEF, dependency-cruiser e flag TS, con baseline.
   - **Ondata 2:** autofix meccanici in commit separati.
   - **Ondata 3:** interventi guidati dal rischio (controlli ASVS mancanti).
   - **Ondata 4:** riduzione della baseline.

### Pilota: AntiPhishing-Bot (rilevato il 2026-10-05)

- Monorepo `frontend` (Vite, React, Capacitor) / `server` / `shared`, Prisma 7,
  78 file TS, 8 file di test, 1 `eslint-disable`, 1 TODO.
- Yarn 1.22, nessun `packageManager`; `@black-bytes/eslint-config` 0.2.x.
- Hook: pre-commit con `yarn typecheck` completo (contro `GIT-HOOK-001`) e
  `npx lint-staged`; lint-staged senza `--max-warnings=0`.
- tsconfig: `strict` sì; `noUncheckedIndexedAccess` ed
  `exactOptionalPropertyTypes` no.
- Nessuna CI; due Dockerfile in `infra/docker/`.

Migrazione a Yarn Modern (prima PR dell'ondata 0):
1. `packageManager: yarn@4.x`, `.yarnrc.yml` con `nodeLinker: node-modules`
   (serve anche a Capacitor), `corepack enable` per ogni dev.
2. Lockfile rigenerato: le versioni risolte possono cambiare → verificare
   typecheck, test, build web, build Android, immagini Docker.
3. `yarn workspaces run …` → `yarn workspaces foreach -A run …`.
4. `"prepare": "husky"` → in `postinstall` con `prisma generate` (Yarn Modern
   non esegue `prepare`: senza questo gli hook non si installano sui nuovi
   clone).
5. `npx lint-staged` → `yarn lint-staged`.
6. Dockerfile: `corepack enable` + `yarn install --immutable`;
   `yarn workspaces focus --production` per l'immagine server.
7. `npmMinimalAgeGate: 1440`: niente installazioni di release uscite da meno di
   24 ore.
8. Da fare con pochi branch aperti e da mergiare in fretta.

## Da prendere da three-man-team

- Sì: formato della review e regola "non approvare per far andare avanti";
  revisore con contesto pulito che legge solo piano e diff; separazione tra
  decisioni tecniche e decisioni da passare all'umano; "Known Gaps" (qui:
  "Aggiornamenti in corsa" e debito tracciato da issue).
- No: personaggi, ciclo a tre agenti con file di handoff, deploy gate,
  controllo versione via `curl` di un JSON remoto, ID modello scritti a mano,
  formato commit `[Step N]` (in conflitto con commitlint).

## Note

- `tests/nest.test.mjs` fallisce con `FORCE_COLOR` impostato nell'ambiente: i
  codici colore ANSI rompono la regex sull'output. Da rendere robusto
  (forzare `NO_COLOR` nel processo figlio o rimuovere le sequenze ANSI).
- Domande aperte dalla sessione "sonarqube e simili", da riprendere per il
  progetto grande: monorepo o più repository, soglie iniziali severe sul codice
  nuovo oppure misura di un punto di partenza.
