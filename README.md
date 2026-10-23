# ACUAS Fitness

Aplicação web para montar, organizar e conduzir aulas coletivas de fitness com uma identidade visual alinhada à marca ACUAS Fitness.

## Funcionalidades

- **Modo Construção:** montar e reorganizar a sequência de exercícios.
- **Modo Script:** consultar a sequência em um formato simplificado para conduzir a aula.
- **Modo Play:** acompanhar a aula com cronômetro, progresso e controles de reprodução.
- **Banco de exercícios:** pesquisar por nome e categoria e adicionar exercícios à aula.
- **Organização da sequência:** agrupar exercícios, reunir exercícios no mesmo tempo e ajustar a ordem.
- **Salvamento local:** guardar aulas no navegador atual.
- **Importação e exportação:** importar e exportar arquivos de aula em JSON.
- **Sinais sonoros e visuais:** alertas nos últimos segundos e controle de som.
- **Tela cheia:** ampliar a visualização do cronômetro.

## Começar a usar

A aplicação não exige etapa de build nem instalação de dependências.

1. Clone ou baixe este repositório.
2. Sirva a pasta por HTTP local (necessário para carregar o banco JSON), por exemplo com a extensão **Live Server** do VS Code.
3. Abra a URL local no navegador.

> Abrir o arquivo `index.html` diretamente via `file://` pode impedir o carregamento de `data/exercises.json`. O site publicado no GitHub Pages já é servido por HTTPS.

## Estrutura do projeto

```text
.
├── index.html           # Estrutura e controles da interface
├── styles.css           # Estilos, layout e temas visuais
├── app.js               # Estado da aplicação, eventos, timer e renderização
└── data/
    └── exercises.json   # Banco de exercícios e metadados
```

## Dados e privacidade

- As aulas salvas pelo recurso local ficam no armazenamento do navegador utilizado.
- Para transferir uma aula entre dispositivos ou navegadores, use **Salvar arquivo** e depois **Importar arquivo**.
- O banco de exercícios é carregado de `data/exercises.json`.

## Desenvolvimento

- Use nomes descritivos para variáveis, funções, classes e IDs.
- Prefira alterações pequenas e focadas, mantendo separados estrutura HTML, estilos CSS e comportamento JavaScript.
- Preserve os modos Construção, Script e Play ao modificar a interface.
- Não remova nem altere exercícios do banco como parte de uma refatoração visual ou de legibilidade.
- Antes de publicar, valide a sintaxe JavaScript, o JSON e os principais fluxos da aplicação.

## Publicação

O projeto está configurado para publicação pelo GitHub Pages. Consulte o workflow em `.github/workflows/pages.yml` para detalhes do processo de deploy.

## Links

- **Aplicação:** https://hezirbrasil.github.io/aulas-coletivas/
- **Repositório:** https://github.com/hezirbrasil/aulas-coletivas
