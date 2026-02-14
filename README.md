<![CDATA[<div align="center">

# ⭐ Polaris

**AI-Powered Browser-Based Code Editor**

Build, edit, and preview web projects — all from your browser — with an intelligent AI coding assistant by your side.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-FF6B35?logo=convex)](https://convex.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

Polaris is a full-featured, browser-based IDE that combines a modern code editor with an AI coding assistant. It runs your projects entirely in the browser using [WebContainers](https://webcontainers.io/), giving you instant previews without needing a remote server. Ask the AI to create files, refactor code, or scaffold entire features — all through natural language conversation.

## ✨ Features

- **🤖 AI Coding Assistant** — Chat with an intelligent agent that can read, create, edit, rename, and delete files in your project. Powered by [Inngest Agent Kit](https://www.inngest.com/docs/agent-kit/overview) and Google Gemini.
- **📝 Rich Code Editor** — Full-featured [CodeMirror](https://codemirror.net/) editor with syntax highlighting, indentation markers, minimap, and multi-language support (JavaScript, TypeScript, HTML, CSS, JSON, Python, Markdown).
- **⚡ Live In-Browser Preview** — Run your apps directly in the browser via [WebContainers](https://webcontainers.io/) — no server needed. See changes reflected in real time.
- **📂 Project Management** — Create, organize, and manage multiple projects with a file-tree explorer, drag-and-drop support, and customizable build/dev commands.
- **🔗 GitHub Integration** — Import repositories from GitHub and export your projects back. Seamless two-way sync for your workflow.
- **💬 Conversation History** — Keep track of all your AI conversations per project. Auto-generated titles and full message history.
- **🔐 Authentication** — Secure sign-in with [Clerk](https://clerk.com/), including GitHub OAuth support.
- **📊 Error Monitoring** — Production-grade error tracking and performance monitoring via [Sentry](https://sentry.io/).
- **🌙 Dark Theme** — Sleek, modern dark UI built with [Radix UI](https://www.radix-ui.com/) primitives and [Tailwind CSS](https://tailwindcss.com/).

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Backend / Database** | [Convex](https://convex.dev/) (real-time serverless backend) |
| **Authentication** | [Clerk](https://clerk.com/) |
| **AI / LLM** | [Vercel AI SDK](https://sdk.vercel.ai/) + [Inngest Agent Kit](https://www.inngest.com/docs/agent-kit/overview) + Google Gemini |
| **Background Jobs** | [Inngest](https://www.inngest.com/) |
| **Code Editor** | [CodeMirror 6](https://codemirror.net/) |
| **In-Browser Runtime** | [WebContainers API](https://webcontainers.io/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Animations** | [Motion](https://motion.dev/) (Framer Motion) |
| **Web Scraping** | [Firecrawl](https://www.firecrawl.dev/) |
| **Error Monitoring** | [Sentry](https://sentry.io/) |
| **Charts** | [Recharts](https://recharts.org/) |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Convex](https://convex.dev/) account (free tier available)
- A [Clerk](https://clerk.com/) account (free tier available)
- A [Google AI](https://aistudio.google.com/apikey) API key (for Gemini)
- An [Inngest](https://www.inngest.com/) account (free tier available)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/BhushanLagare7/polaris.git
   cd polaris
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the project root and populate the following variables:

   ```env
   # Convex
   NEXT_PUBLIC_CONVEX_URL=           # Your Convex deployment URL
   POLARIS_CONVEX_INTERNAL_KEY=      # Internal key for server-side Convex mutations

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=

   # AI Providers
   GOOGLE_GENERATIVE_AI_API_KEY=     # Google Gemini API key

   # Inngest
   INNGEST_EVENT_KEY=
   INNGEST_SIGNING_KEY=

   # Firecrawl (optional — for URL scraping in AI conversations)
   FIRECRAWL_API_KEY=

   # Sentry (optional — for error monitoring)
   SENTRY_AUTH_TOKEN=
   SENTRY_ORG=
   SENTRY_PROJECT=
   ```

4. **Start the Convex backend**

   ```bash
   npx convex dev
   ```

5. **Start the development server** (in a separate terminal)

   ```bash
   npm run dev
   ```

6. **Start Inngest Dev Server** (in a separate terminal)

   ```bash
   npx inngest-cli@latest dev
   ```

7. **Open your browser**

   Visit [http://localhost:3000](http://localhost:3000) to start using Polaris.

## 📁 Project Structure

```
polaris/
├── convex/                  # Convex backend (schema, queries, mutations)
│   ├── schema.ts            # Database schema (projects, files, conversations, messages)
│   ├── projects.ts          # Project CRUD operations
│   ├── files.ts             # File management operations
│   ├── conversations.ts     # Conversation operations
│   └── system.ts            # Internal system mutations
├── public/                  # Static assets (logos, icons)
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   │   ├── api/             # REST endpoints (messages, GitHub, inngest)
│   │   └── projects/        # Project workspace page
│   ├── components/
│   │   ├── ai-elements/     # AI chat UI (prompt input, messages, code blocks, etc.)
│   │   └── ui/              # Reusable UI primitives (shadcn/ui + Radix)
│   ├── features/
│   │   ├── auth/            # Authentication views
│   │   ├── conversations/   # AI conversation logic & Inngest agent
│   │   ├── editor/          # CodeMirror editor components & extensions
│   │   ├── preview/         # WebContainer live preview
│   │   └── projects/        # Project management & GitHub sync
│   ├── hooks/               # Custom React hooks
│   ├── inngest/             # Inngest client & function definitions
│   └── lib/                 # Utility modules (Convex client, Firecrawl, helpers)
├── next.config.ts           # Next.js configuration with Sentry plugin
├── package.json
└── tsconfig.json
```

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create an optimized production build |
| `npm start` | Run the production server |
| `npm run lint` | Run ESLint checks |
| `npm run lint:fix` | Auto-fix ESLint issues |

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch** — `git checkout -b feature/your-feature`
3. **Commit your changes** — `git commit -m "feat: add your feature"`
4. **Push to your branch** — `git push origin feature/your-feature`
5. **Open a Pull Request**

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙋 Support

If you run into issues or have questions:

- **Open an issue** on [GitHub Issues](https://github.com/BhushanLagare7/polaris/issues)
- **Start a discussion** on [GitHub Discussions](https://github.com/BhushanLagare7/polaris/discussions)

---

<div align="center">

Built with ❤️ by [Bhushan Lagare](https://github.com/BhushanLagare7)

</div>
]]>
