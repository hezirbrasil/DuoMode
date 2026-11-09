# DuoMode — Synchronized Fight & Workout Timer

**AI-assisted application project | Functional testing | Iterative quality improvement**

[Live application](https://hezirbrasil.github.io/DuoMode/) · [Repository](https://github.com/hezirbrasil/DuoMode)

## Overview

DuoMode is a browser-based application for planning and running two independent but synchronized training sessions: **Fight** (combat combinations and techniques) and **Workout** (physical exercises). Both timers run together in Play mode.

This project is part of an independent, AI-assisted application development portfolio. The workflow focused on translating requirements into prompts, reviewing generated implementations, repeatedly testing user-facing behavior, identifying inconsistencies, and refining the application.

## Key features

- Independent builders for Fight and Workout sessions.
- Searchable Workout exercise bank with muscle-group filters.
- Fight combination index organized by opening technique.
- Add exercises from the bank or create custom entries.
- Separate work and rest duration fields (minutes and seconds).
- Edit, reorder, remove, group, ungroup, duplicate, and standardize session items.
- Session structure with exercise count and sequence.
- Synchronized dual timers with playback controls.
- JSON import and export for both sessions.
- Responsive interface with a dark, purple, and white visual theme.

## Quality assurance and testing

The repository includes a Playwright regression test suite covering important user workflows, including:

- Loading the Workout exercise bank and duration fields.
- Adding a Workout exercise with work and rest times.
- Creating a custom Fight exercise.
- Switching between builder and Play modes.
- Grouping and duplicating a set of exercises.

The project also includes a GitHub Actions workflow for manually running automated tests. The presence of these tests documents the intended validation coverage; it does not by itself imply that every test run has passed.

## AI-assisted development and evaluation workflow

My contribution to this project focused on:

1. Defining application requirements and expected user behavior.
2. Translating requirements into structured prompts for AI tools.
3. Reviewing AI-generated changes against the requested behavior.
4. Repeatedly testing features and identifying unexpected results.
5. Refining prompts and requirements when results did not match expectations.
6. Iterating on the application and maintaining project versions in GitHub.

**Tools used:** ChatGPT, Claude, GitHub, Supabase, and Visual Studio Code.

The application was developed primarily through prompt-based AI assistance. This portfolio describes hands-on requirement definition, output review, and functional validation—not professional software engineering or independent authorship of all source code.

## Technologies in the repository

- HTML5
- CSS3
- JavaScript (no application framework)
- Node.js tooling
- Playwright for browser regression tests
- GitHub Pages for deployment

## Run locally

1. Clone this repository.
2. Install development dependencies: `npm install`.
3. Start the local server: `npm run dev`.
4. Open `http://localhost:4173`.

Run the automated test suite with `npm test`.

## Privacy

The application runs in the browser. Session data is not sent to an application server. JSON import/export can be used to transfer session configurations between devices.

---

# Versão em português

## Visão geral

O DuoMode é uma aplicação web para planejar e conduzir duas aulas independentes e sincronizadas: **Fight** (combinações e técnicas de luta) e **Workout** (exercícios físicos). Os dois cronômetros funcionam juntos no modo Play.

Este projeto integra um portfólio de desenvolvimento assistido por IA. O processo envolveu transformar requisitos em prompts, revisar resultados gerados, testar repetidamente as funcionalidades, identificar inconsistências e aprimorar a aplicação.

## Testes e qualidade

O repositório contém testes de regressão com Playwright para verificar fluxos como carregamento do banco de exercícios, inclusão de exercícios, criação de itens personalizados, alternância entre construtor e modo Play, agrupamento e duplicação.

A existência dos testes documenta a cobertura de validação planejada, mas não significa, por si só, que todas as execuções tenham sido aprovadas.

## Minha participação no projeto

- Definição de requisitos e comportamentos esperados.
- Criação e refinamento de prompts para ferramentas de IA.
- Revisão das implementações geradas pela IA.
- Testes funcionais repetidos e identificação de inconsistências.
- Refinamento de instruções e requisitos.
- Iteração e organização das versões do projeto no GitHub.

**Ferramentas:** ChatGPT, Claude, GitHub, Supabase e Visual Studio Code.

O desenvolvimento foi realizado principalmente com assistência de IA por meio de prompts. A descrição destaca definição de requisitos, revisão de resultados e validação funcional, sem alegar atuação como engenheiro de software profissional.
