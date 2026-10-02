# Documentação — Agenda Santa Teresinha

Guia da estrutura do projeto: o que cada pasta e arquivo-chave faz, como o sistema está organizado e quais partes **não devem ser editadas à mão**.

---

## Visão geral

A aplicação é uma agenda paroquial com:

- **Calendário de eventos** (`/app`) — eventos das pastorais, com aprovação e bloqueio de choque de horário por grupo.
- **Calendário litúrgico** (`/app/liturgical`) — datas da Igreja com as cores litúrgicas oficiais; editável apenas por administradores.
- **Notas** (`/app/notes`) — anotações pessoais de cada usuário, ligadas aos eventos.
- **Aprovações** (`/app/aprovacoes`) — fila de eventos pendentes para quem pode aprovar (admin, padre, coordenação).
- **Pastorais** (`/app/pastorais`) — criação de grupos e vínculo de membros (só admin).
- **Usuários** (`/app/usuarios`) — criação de acessos por nome + celular, com senha temporária trocada no primeiro acesso (só admin).
- **Login por celular** — o celular vira um "e-mail interno" (`@celular.local`); cadastro público está desativado, todo acesso é criado pelo admin.

---

## Stack (linguagens e tecnologias)

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (todo o código) |
| Interface | React 19 |
| Framework | TanStack Start v1 (Vite 7; roda em Cloudflare Workers ao publicar) |
| Roteamento | TanStack Router (rotas por arquivo) |
| Dados no client | TanStack Query |
| Banco de dados | PostgreSQL (Lovable Cloud / Supabase) |
| Autenticação | Supabase Auth (login por celular convertido em e-mail interno) |
| Segurança | RLS (Row Level Security) + funções RPC no banco |
| Tempo real | Supabase Realtime (eventos atualizam sozinhos) |
| Estilos | Tailwind CSS v4 + componentes shadcn/Radix UI |
| Validação | Zod |
| Datas | date-fns |
| Ícones | lucide-react |
| Deploy | Cloudflare Workers (config em `wrangler.jsonc`); alternativa Netlify (`netlify.toml`) |

---

## Estrutura de pastas

```
├── DOCUMENTACAO.md          ← este arquivo
├── AGENTS.md                ← regras técnicas do projeto
├── package.json             ← dependências e scripts (dev, build, lint)
├── vite.config.ts           ← configuração do build (gerenciada pela plataforma)
├── wrangler.jsonc           ← configuração de deploy (Cloudflare)
├── netlify.toml             ← deploy alternativo (Netlify)
├── components.json          ← configuração dos componentes shadcn/ui
├── tsconfig.json            ← configuração do TypeScript
├── supabase/
│   ├── config.toml          ← vínculo com o banco (auto-gerado)
│   └── migrations/          ← histórico versionado do banco de dados (SQL)
├── src/
│   ├── routes/              ← PÁGINAS (uma arquivo = uma URL)
│   ├── components/ui/       ← componentes de interface prontos (botões, diálogos…)
│   ├── lib/                 ← lógica de auth, permissões e regras de negócio
│   ├── integrations/        ← conexões com serviços (auto-geradas — não editar)
│   ├── hooks/               ← hooks utilitários (ex.: detecção de celular)
│   ├── assets/              ← imagens do site
│   ├── styles.css           ← cores, fontes e tema visual
│   ├── router.tsx           ← criação do roteador
│   ├── start.ts             ← middleware global (anexa o token de login)
│   └── routeTree.gen.ts     ← GERADO AUTOMATICAMENTE — não editar
└── .env                     ← variáveis de ambiente (auto-geradas)
```

---

## Páginas (`src/routes/`)

Um arquivo aqui equivale a uma URL da aplicação:

| Arquivo | URL | O que faz |
|---|---|---|
| `__root.tsx` | — | Layout raiz: título/SEO, provedor de login e notificações |
| `index.tsx` | `/` | Redireciona: quem não está logado vai para `/auth`, quem está vai para `/app` |
| `auth.tsx` | `/auth` | Tela de login (celular ou e-mail + senha) |
| `definir-senha.tsx` | `/definir-senha` | Troca obrigatória de senha no primeiro acesso |
| `reset-password.tsx` | `/reset-password` | Redefinição de senha por link |
| `app.tsx` | `/app` | Layout protegido: menu lateral (colapsável, versão mobile inclusa) + bloqueio de quem não está logado ou precisa trocar senha |
| `app.index.tsx` | `/app` | Calendário de eventos: criar/editar/excluir, tooltip com quem agendou |
| `app.liturgical.tsx` | `/app/liturgical` | Calendário litúrgico com cores oficiais; edição restrita ao admin |
| `app.notes.tsx` | `/app/notes` | Bloco de notas pessoal de cada usuário |
| `app.aprovacoes.tsx` | `/app/aprovacoes` | Aprovar/rejeitar eventos pendentes, com motivo da rejeição |
| `app.pastorais.tsx` | `/app/pastorais` | Criar pastorais, adicionar/remover membros (admin) |
| `app.usuarios.tsx` | `/app/usuarios` | Criar acessos, gerar nova senha, definir papel, excluir (admin) |

O menu lateral em `app.tsx` mostra itens conforme o papel: **Aprovações** aparece para admin, padre e coordenação; **Pastorais** e **Usuários** só para admin.

---

## Lógica e permissões (`src/lib/`)

- `auth-context.tsx` — mantém a sessão do usuário em toda a aplicação (`useAuth`).
- `use-roles.ts` — lê os papéis do usuário (`admin`, `padre`, `coordenacao`, `coordenador`, `membro`) e diz quem pode aprovar eventos.
- `admin-auth.ts` — middleware que protege as funções administrativas no servidor: valida o token e confirma o papel de admin no banco antes de executar qualquer ação sensível.
- `admin.functions.ts` — funções administrativas: criar acesso (nome + celular → senha temporária), resetar senha, mudar papel, excluir usuário, listar usuários.
- `admin.server.ts` — ajudantes exclusivos do servidor, incluindo o gerador de senha temporária (formato `PGKD-4827`, sem caracteres ambíguos).
- `admin-schemas.ts` — validações dos dados recebidos (Zod).
- `phone.ts` — converte celular brasileiro em "e-mail interno" de login (`5531...@celular.local`).
- `liturgical.ts` — cores litúrgicas oficiais (roxo, branco, vermelho, verde, rosa, dourado, preto) e categorias de evento.

### Regras de segurança aplicadas no banco

- **RLS** em todas as tabelas: cada usuário só vê/escreve o que tem direito; eventos são públicos para leitura, notas são privadas.
- Eventos têm status `pendente / aprovado / rejeitado` com registro de quem aprovou e quando.
- **Trigger `events_no_overlap`**: o banco recusa dois eventos do mesmo grupo no mesmo horário.
- Papéis ficam em `user_roles`; só o admin altera papéis (política restritiva no banco).
- Cadastro público desativado: toda conta nasce pelo admin, com senha temporária e troca obrigatória no primeiro acesso.

---

## Banco de dados (`supabase/migrations/`)

Cada arquivo é uma mudança versionada no banco, aplicada em ordem. **Nunca editar uma migration antiga** — novas mudanças entram em arquivos novos.

Principais tabelas: `profiles` (nome, celular, troca de senha obrigatória), `events` (com `category`, status e auditoria de aprovação), `notes`, `liturgical_events`, `pastorais`, `pastoral_members`, `user_roles`.

---

## Integrações (`src/integrations/`) — auto-geradas, não editar

- `supabase/client.ts` — conexão do navegador com o banco (respeita as permissões do usuário).
- `supabase/client.server.ts` — conexão privilegiada, só no servidor, para ações de admin.
- `supabase/auth-middleware.ts` — valida o token em cada função de servidor.
- `supabase/auth-attacher.ts` — anexa o token automaticamente em toda chamada ao servidor (registrado em `src/start.ts`).
- `supabase/types.ts` — tipos gerados a partir das tabelas.
- `lovable/index.ts` — login com Google via corretor da plataforma.

Esses arquivos são regenerados pela plataforma; edições manuais seriam perdidas.

---

## Componentes e estilos

- `src/components/ui/` — componentes prontos (botão, diálogo, calendário, sidebar, notificações…), usados por todas as páginas.
- `src/styles.css` — tema visual (tons de marrom, bege e rosa pastel) com tokens de cor centralizados.
- `src/hooks/use-mobile.tsx` — detecta tela de celular (usado pelo menu lateral).
- `src/assets/` — imagens estáticas.

---

## Arquivos que nunca devem ser editados à mão

| Arquivo | Por quê |
|---|---|
| `src/routeTree.gen.ts` | Gerado a partir das pastas de `src/routes/` |
| `src/integrations/supabase/*` | Regenerados pela plataforma |
| `src/integrations/lovable/index.ts` | Auto-gerado pela plataforma |
| `supabase/migrations/*` (antigas) | Histórico imutável do banco |
| `.env` | Gerenciado pela plataforma |
| `package-lock.json` / `bun.lockb` | Gerenciados pelo instalador de pacotes |

---

## Observações

- Não há testes automatizados no projeto ainda.
- O envio das credenciais ao novo usuário é feito pela própria pessoa admin: botão de SMS (`sms:`) ou "Copiar mensagem" — sem custo de plataforma.
