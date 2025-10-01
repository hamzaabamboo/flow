# Tech Stack & Architecture

## 🏗️ Project Overview

**HamFlow** is a personalized productivity hub SPA (Single Page Application) built for speed and developer experience.

## 🎯 Core Technologies

### Frontend
- **React 19**: Latest React with concurrent features
- **Vike**: File-based routing and SSR framework
- **PandaCSS**: Zero-runtime CSS-in-JS styling
- **Park UI**: Pre-built accessible components
- **Ark UI**: Headless UI primitives
- **React Query (Tanstack Query)**: Server state management

### Backend
- **ElysiaJS**: Fast, type-safe API framework
- **Bun**: JavaScript runtime and toolkit
- **Drizzle ORM**: Type-safe database toolkit
- **PostgreSQL**: Primary database
- **WebSockets**: Real-time communication

### Development Tools
- **TypeScript**: End-to-end type safety
- **Vite**: Build tool and dev server
- **Biome**: Fast linter and formatter
- **pnpm/bun**: Package management

## 🔗 External Documentation

### Core Frameworks
- **ElysiaJS**: https://elysiajs.com/llms-full.txt
- **Drizzle ORM**: https://orm.drizzle.team/llms-full.txt
- **PandaCSS**: https://panda-css.com/llms-full.txt
- **Vike**: https://vike.dev/

### UI Libraries
- **Park UI**: https://park-ui.com/
- **Ark UI**: https://ark-ui.com/llms-react.txt
- **React Query**: https://tanstack.com/query/latest

### Runtime & Tools
- **Bun**: https://bun.sh/docs
- **PostgreSQL**: https://www.postgresql.org/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

## 🏛️ Architecture Patterns

### API Design
- RESTful endpoints with ElysiaJS
- Type-safe contracts with Eden Treaty
- WebSocket support for real-time features
- JWT-based authentication

### State Management
- Server state: React Query
- Client state: React Context + hooks
- Form state: React Hook Form
- Global auth: ElysiaJS context propagation

### Database Strategy
- Drizzle ORM for type safety
- PostgreSQL for ACID compliance
- Migrations in `drizzle/` directory
- Connection pooling via Drizzle

### Styling Approach
- PandaCSS for zero-runtime styles
- Park UI for consistent components
- Design tokens for theming
- Responsive-first design

## 🔄 Data Flow

```
User Action → React Component → React Query → Eden Treaty → ElysiaJS API
                                                  ↓
Browser ← React Re-render ← React Query Cache ← Database (PostgreSQL)
```

## 🚀 Performance Optimizations

1. **SSR with Vike**: Initial page loads are server-rendered
2. **Bun Runtime**: Faster than Node.js for server operations
3. **React 19**: Concurrent features and automatic batching
4. **PandaCSS**: Zero runtime overhead for styles
5. **Edge Caching**: Static assets served from CDN
6. **Database Indexing**: Optimized queries with proper indices

## 🔒 Security Measures

1. **JWT Authentication**: Secure token-based auth
2. **CORS Configuration**: Proper origin validation
3. **Input Validation**: Zod schemas for all inputs
4. **SQL Injection Prevention**: Parameterized queries via Drizzle
5. **XSS Protection**: React's automatic escaping
6. **HTTPS Only**: Enforced in production

## 📦 Key Dependencies

```json
{
  "frontend": {
    "react": "^19.0.0",
    "vike": "^0.4.0",
    "@tanstack/react-query": "^5.0.0",
    "@ark-ui/react": "^4.0.0"
  },
  "backend": {
    "elysia": "^1.0.0",
    "drizzle-orm": "^0.30.0",
    "@elysiajs/jwt": "^1.0.0",
    "@elysiajs/cors": "^1.0.0"
  },
  "development": {
    "typescript": "^5.5.0",
    "vite": "^5.0.0",
    "@biomejs/biome": "^1.0.0"
  }
}
```