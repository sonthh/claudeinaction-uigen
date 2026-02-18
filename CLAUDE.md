# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; Claude generates code that runs in a sandboxed iframe using a virtual in-memory file system.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (all tests)
npm run setup        # Install deps + Prisma generate + migrate (first-time setup)
npm run db:reset     # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Architecture

### Virtual File System
The core abstraction is `VirtualFileSystem` (`src/lib/file-system.ts`). All generated files exist only in memory — nothing is written to disk. The VFS serializes to JSON for persistence in the database (`Project.data` column).

### AI Integration
- **Provider** (`src/lib/provider.ts`): Wraps Anthropic Claude (claude-haiku-4-5). Falls back to `MockLanguageModel` if `ANTHROPIC_API_KEY` is missing.
- **Tools**: Claude uses two tools operating on the VFS:
  - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — create/view/edit files
  - `file_manager` (`src/lib/tools/file-manager.ts`) — rename/delete/list files
- **System prompt**: `src/lib/prompts/generation.tsx`
- **Chat endpoint**: `src/app/api/chat/route.ts` — streams responses via SSE, saves project after completion

### JSX Transformation Pipeline
`src/lib/transform/jsx-transformer.ts` uses `@babel/standalone` in the browser to:
1. Parse JSX/TSX files from the VFS
2. Transform to vanilla JS
3. Create blob URLs loaded in an iframe for live preview

### State Management
- `src/lib/contexts/file-system-context.tsx` — wraps VFS, provides file operations to the React tree
- `src/lib/contexts/chat-context.tsx` — manages chat messages, integrates Vercel AI SDK's `useChat`, tracks file changes from tool calls

### UI Layout
Three-panel resizable layout in `src/app/main-content.tsx`:
- **Left**: `ChatInterface` (chat + message input)
- **Right**: tabbed between `PreviewFrame` (iframe) and code view (`FileTree` + `CodeEditor` using Monaco)

### Authentication
JWT sessions stored in HttpOnly cookies. `src/middleware.ts` protects routes. Supports anonymous users (no `userId` on projects). Server Actions in `src/actions/` handle auth and project CRUD.

### Database
Prisma + SQLite. Schema defined in `prisma/schema.prisma` — reference it for the full data model.

## Key Conventions
- Import alias `@/*` maps to `src/*`
- All UI primitives are Radix UI-based wrappers in `src/components/ui/`
- Tests live in `__tests__/` subdirectories alongside source
- Tailwind CSS v4 for all styling — no hardcoded CSS
- Use comments sparingly — only comment complex code
