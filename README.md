# HamFlow

Your personalized productivity hub - a centralized, intelligent command center for your digital life.

## Tech Stack

- **Runtime**: Bun
- **Backend**: ElysiaJS with WebSocket support
- **Frontend**: React 19 with Vike (SSR)
- **Database**: PostgreSQL via HamCloud with Drizzle ORM
- **AI**: Mastra framework with Google AI SDK
- **State Management**: Tanstack Query

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- PostgreSQL database (via HamCloud or local)
- API keys for integrations (HamBot, Notes Server, Google AI)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd hamflow
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
# Make sure to change JWT_SECRET to something secure
```

4. Run database migrations:
```bash
bun db:generate
bun db:migrate
```

5. Start development server:
```bash
bun dev
```

6. Initial setup (first time only):
- Navigate to http://localhost:3001/login
- Click "Setup account" to create your user
- Save the generated USER_PASSWORD_HASH to your .env file
- Use "Quick Login" for future access

The application will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## Development

### Available Scripts

- `bun dev` - Start development servers (frontend + backend)
- `bun build` - Build for production
- `bun start` - Start production server
- `bun db:generate` - Generate database migrations
- `bun db:migrate` - Run database migrations
- `bun db:studio` - Open Drizzle Studio for database management
- `bun lint` - Run ESLint
- `bun type-check` - Check TypeScript types

## Project Structure

```
hamflow/
├── src/
│   ├── server/          # Backend (ElysiaJS)
│   │   ├── routes/      # API routes
│   │   ├── database/    # Database utilities
│   │   └── index.ts     # Server entry with SSR
│   ├── pages/           # Frontend pages (Vike)
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Shared utilities
│   └── mastra/          # AI agents and tools
├── drizzle/             # Database schema and migrations
├── public/              # Static assets
└── scripts/             # Build and utility scripts
```

## Features Roadmap

### Phase 0: Foundation ✅
- [x] Project scaffolding
- [x] Database schema
- [x] Basic routing
- [ ] HamCloud auth integration

### Phase 1: Core Kanban
- [ ] Board CRUD operations
- [ ] Drag-and-drop tasks
- [ ] Real-time WebSocket sync
- [ ] Work/Personal space separation

### Phase 2: Calendar & Time
- [ ] Google Calendar integration
- [ ] Task due dates sync
- [ ] Agenda view

### Phase 3: AI & Automation
- [ ] Command bar with natural language
- [ ] Voice input
- [ ] HamBot notifications
- [ ] Reminder scheduling

See `design_document.md` for full feature specifications.