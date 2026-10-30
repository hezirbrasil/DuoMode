# DuoMode — Workout & Fight Timer

Aplicação web para montar e conduzir duas aulas simultâneas e independentes: **Fight** (combinações e técnicas de luta) e **Workout** (exercícios físicos). Os dois cronômetros são sincronizados no modo Play.

**Aplicação:** https://hezirbrasil.github.io/DuoMode/  
**Repositório:** https://github.com/hezirbrasil/DuoMode

## Funcionalidades

- Construtores independentes para Fight e Workout.
- Banco de exercícios do Workout, com pesquisa e filtros por grupamento muscular.
- Índice de combinações Fight organizado pelo golpe que inicia a sequência.
- Inclusão de itens pelo banco ou criação manual.
- Configuração de tempo e descanso em campos separados de minutos e segundos.
- Edição, reordenação, remoção, agrupamento, desagrupamento e padronização de tempos.
- Estrutura da aula com contagem e ordem dos exercícios.
- Modo Play com dois cronômetros sincronizados, controles de reprodução e retorno ao construtor.
- Exportação e importação das duas aulas em JSON.
- Interface responsiva com tema preto, roxo e branco.

## Começar

A aplicação é estática e não exige etapa de build.

1. Clone o repositório.
2. Instale as dependências de desenvolvimento: `npm install`.
3. Inicie um servidor local: `npm run dev`.
4. Abra `http://localhost:4173`.

Também é possível usar qualquer servidor HTTP estático. Evite abrir `index.html` diretamente com `file://`, pois o navegador pode bloquear o carregamento de scripts e dados.

## Estrutura

```text
.
├── index.html                 # Estrutura da interface e formulários
├── styles.css                 # Layout, responsividade e identidade visual
├── app.js                     # Estado, eventos, renderização e integração dos modos
├── data/
│   ├── exercises.js           # Banco de exercícios Workout
│   ├── duo-timer.js            # Lógica isolada do cronômetro Duo
│   ├── workout-bank-ui.js      # Filtros e interação do banco
│   └── duo-diagnostics.js      # Diagnóstico de erros de inicialização
├── tests/
│   └── regression.spec.js     # Testes de regressão Playwright
├── .github/workflows/
│   ├── pages.yml              # Deploy automático no GitHub Pages
│   └── automated-tests.yml    # Execução manual dos testes
├── package.json
└── playwright.config.js
```

## Desenvolvimento e qualidade

- Mantenha HTML, CSS, dados e lógica de cronômetro em arquivos separados.
- Use nomes descritivos e funções pequenas, com responsabilidades claras.
- Evite duplicar manipuladores de eventos e regras de validação.
- Preserve os índices Fight por golpe inicial e o banco Workout durante refatorações.
- Execute `npm test` antes de publicar alterações.
- O deploy é acionado por push na branch `main`; os testes de regressão são executados manualmente pelo workflow do GitHub Actions.

## Tecnologias

HTML, CSS, JavaScript (sem framework), Node.js e Playwright para testes de navegador.

## Privacidade

A aplicação funciona no navegador. Os dados da aula não são enviados a um servidor de aplicação. A exportação/importação em JSON permite transportar as configurações entre dispositivos.
