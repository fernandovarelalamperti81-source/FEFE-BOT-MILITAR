# FEFE BOT MILITAR — starter

Protótipo inicial para vincular uma conta Roblox e sincronizar um cargo Discord com a patente pública de um grupo Roblox.

## O que este starter faz

- `/vincular usuario_roblox:Nome`: cria código temporário (10 minutos).
- No jogo, o jogador envia `!vincular CODIGO`; o Script do servidor confirma o UserId e nome junto ao serviço.
- `/patente`: consulta a patente pública do grupo configurado.
- `/sincronizar`: mapeia o rank numérico Roblox para um cargo Discord e substitui cargos de patente geridos por este bot.
- Guarda os vínculos e códigos em SQLite.

## Requisitos

- Node.js 20+
- Um bot criado no Discord Developer Portal
- ID do servidor Discord, ID do grupo Roblox e IDs dos cargos Discord
- Serviço Node.js hospedado com armazenamento persistente
- `HttpService` ativado no Roblox Studio

## Instalação local

1. Instale Node.js: https://nodejs.org/
2. Extraia o ZIP e abra um terminal dentro da pasta.
3. Execute `npm install`.
4. Copie `.env.example` para `.env` e preencha os valores.
5. Configure `ROBLOX_RANK_TO_DISCORD_ROLE` com IDs reais de cargos.
6. Execute `npm run register`.
7. Execute `npm start`.
8. Para testes locais, exponha o serviço com uma URL HTTPS de desenvolvimento; a URL deve estar acessível pelo servidor Roblox. Não use túnel temporário em produção.
9. No Roblox Studio, coloque `roblox/ServerScript.lua` como Script em `ServerScriptService`, configure a URL e o segredo, e habilite `Allow HTTP Requests` nas configurações do jogo.

## Configuração do Discord

No Discord Developer Portal:
1. Crie uma Application e adicione um Bot.
2. Copie o token para `DISCORD_TOKEN` no `.env`. Nunca compartilhe nem faça commit desse arquivo.
3. Copie o Application ID para `DISCORD_CLIENT_ID`.
4. Copie o ID do servidor para `DISCORD_GUILD_ID`.
5. Instale o bot no servidor com `bot` e `applications.commands`.
6. Dê ao bot `Manage Roles` e coloque o cargo do bot acima dos cargos de patente que ele precisa gerenciar.
7. Não conceda Administrator se não for necessário.

## IDs de grupo e cargos

- O ID do grupo é o número na URL do grupo Roblox.
- Ative o Modo Desenvolvedor no Discord; clique com botão direito em cada cargo e copie o ID.
- `ROBLOX_RANK_TO_DISCORD_ROLE` usa o número de rank Roblox como chave. Confira os ranks reais do seu grupo antes de preencher.
- Cada rank mapeado precisa ter um cargo Discord existente. O bot não cria cargos automaticamente.

## Hospedagem

Render oferece Web Services gratuitos para testes, mas serviços gratuitos podem dormir após inatividade e o sistema de arquivos local é efêmero. Como este starter usa SQLite local, NÃO faça deploy no plano gratuito do Render sem trocar o banco por um serviço persistente. Para produção, use hospedagem Node com processo sempre ativo e volume persistente, ou migre o banco para PostgreSQL gerenciado.

## Segurança — antes de publicar

- O exemplo do Script Roblox usa um segredo compartilhado para facilitar o primeiro teste. Coloque o Script apenas em `ServerScriptService`; nunca use LocalScript.
- Para produção, use Roblox Secrets/secret manager, HTTPS, rate limits e rotação de segredos. Não deixe um segredo de produção em código-fonte versionado.
- O protótipo guarda códigos e vínculos no SQLite. Use armazenamento persistente em produção.
- O endpoint de confirmação aceita apenas o código que foi gerado para o UserId e username específicos.
- Este código não promove ninguém no Roblox; apenas lê a patente pública e ajusta cargos no Discord.
- A consulta pública de grupos pode mudar/ter limites. Trate falhas como erros e nunca remova cargos em massa quando a API falhar.
- Antes de abrir ao público, adicione logs de auditoria, proteção contra abuso e política de privacidade.

## Teste de ponta a ponta

1. Use um servidor Discord de teste.
2. Crie dois cargos de teste e anote seus IDs.
3. Configure um rank Roblox real e o ID do cargo correspondente.
4. Inicie o bot e confira os logs.
5. No Discord, execute `/vincular usuario_roblox:SEU_NOME`.
6. Entre no jogo e envie `!vincular CODIGO` no chat.
7. Execute `/patente`; confira se o nome da patente está correto.
8. Execute `/sincronizar`; confira se o cargo certo foi atribuído.
9. Mude a patente de teste no grupo Roblox e execute `/sincronizar` de novo.
10. Teste código expirado, conta não membro, ID de cargo incorreto e bot sem permissão.

## Limitações conhecidas

- A sincronização ocorre quando o membro usa `/sincronizar`; sincronização automática periódica ainda não está incluída.
- O bot exige que a conta Discord já esteja no servidor.
- O sistema consulta patentes públicas do grupo; não usa o estado visual de leaderstats como fonte de autoridade.
- O exemplo do Roblox usa `Player.Chatted` para simplificar; em experiências que usam o novo sistema de chat, pode ser necessário adaptar o comando.
