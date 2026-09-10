# Treino & Nutrição — V1.0

PWA pessoal para integrar musculação, CrossFit, nutrição, hidratação, suplementação, evolução corporal e histórico.

## Tecnologias
- HTML, CSS e JavaScript puro
- LocalStorage para persistência no aparelho
- Service Worker para funcionamento offline
- Manifest PWA para instalação na tela inicial
- Exportação e importação de backup em JSON

## Navegação
- Home: indicadores do dia, semana e evolução
- Nutrição: execução diária, planos versionados, suplementos e lista de compras
- Treinos: musculação, CrossFit e recomendação integrada
- Evolução: peso e medidas
- Histórico: calendário unificado por dia

## Dados
A V1.0 foi construída para não sobrescrever histórico. Planos de dieta, suplementação e musculação são versionados por vigência/status. Registros diários ficam independentes do plano atual.

## Estrutura
- `index.html`: interface principal
- `style.css`: estilos
- `app-core.js`: estado, Home e funções centrais
- `app-nutrition.js`: dieta, suplementação e compras
- `app-training.js`: musculação, CrossFit e recomendador
- `app-evolution-history.js`: evolução, histórico, hidratação e backup
- `app-init.js`: inicialização
- `manifest.webmanifest`: configuração PWA
- `sw.js`: cache offline
- `icon.svg`: ícone

## Publicação
O projeto está preparado para publicação como site/PWA. Como o repositório contém dados e código do app, recomenda-se mantê-lo privado e escolher uma hospedagem compatível com repositórios privados.

## Privacidade
Os registros pessoais da V1.0 ficam armazenados localmente no navegador/dispositivo. O repositório contém apenas o código do aplicativo, não os dados lançados durante o uso. Use periodicamente a função de exportar backup JSON para preservar seu histórico.
