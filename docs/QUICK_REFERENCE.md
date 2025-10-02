# Quick Reference Guide

## 🔥 Critical Reminders

1. **Port is 3000**: Dev server runs on `http://localhost:3000` NOT 5173!
2. **No 'any' Types**: Always use proper TypeScript types
3. **Props Stay, Models Move**: Component props in files, data models in shared/types
4. **Use Styled Components**: Import from `ui/styled/` not `ui/` for complex components
5. **Global Auth Context**: Use `{ as: 'global' }` in derive for auth propagation
6. **Logger Error First**: `logger.error(error, 'message')` not the reverse

## 🚀 Common Commands

### Development
```bash
# Start development (PORT 3000, NOT 5173!)
bun run dev

# Check types
bunx tsc --noEmit

# Fix linting
bun run lint:fix

# Build for production
bun run build

# Run tests
bun test
```

### Database
```bash
# ⚠️ NEVER RUN THESE AUTOMATICALLY - ALWAYS ASK USER FIRST
# Generate migrations (USER MUST RUN THIS)
bun run db:generate

# Apply migrations (USER MUST RUN THIS)
bun run db:migrate

# Open database studio
bun run db:studio

# Reset database (caution!)
bun run db:reset
```

**IMPORTANT**: Claude Code should NEVER run `db:generate` or `db:migrate` commands automatically. Always inform the user to run these commands manually after schema changes.

### Debugging
```bash
# Check server logs
tail -f server.log

# Check client bundle
bun run analyze

# Clear cache
rm -rf .vite/ dist/ node_modules/.cache
```

## 📂 Project Structure Quick Lookup

```
hamflow/
├── src/
│   ├── pages/         # Vike pages (file-based routing)
│   ├── components/    # React components
│   ├── server/        # ElysiaJS backend
│   ├── shared/        # Shared types and utilities
│   ├── ui/           # UI components (Park UI)
│   └── lib/          # Library code and utilities
├── drizzle/          # Database schema and migrations
├── docs/             # Documentation
└── public/           # Static assets
```

## 🔗 Quick Links

- **Local Dev**: http://localhost:3000
- **Database Studio**: http://localhost:4983
- **API Docs**: http://localhost:3000/swagger

## 🔔 HamBot Integration

### Environment Variables
```bash
# Required for HamBot daily summaries
HAMBOT_API_KEY=your_api_key_here
INSTANCE_URL=https://your-hamflow-instance.com  # Default: http://localhost:3000
```

### Summary Schedule (JST/Asia/Tokyo)
- **Morning Summary**: 10:00 AM (01:00 UTC)
- **Evening Summary**: 10:00 PM (13:00 UTC)

### User Settings
Users can configure in Settings page:
- Enable/disable morning/evening summaries
- Choose spaces (work/personal/both)
- Test summaries via actual HamBot send

### Summary Content
**Morning** (10:00 AM JST):
- Tasks due today
- Upcoming tasks (next 7 days)
- Link to HamFlow instance

**Evening** (10:00 PM JST):
- Completed tasks/habits count
- Unfinished tasks
- Incomplete habits
- Link to HamFlow instance

## ⚡ Common Gotchas

1. **Vite HMR Issues**: Restart dev server if hot reload stops working
2. **Type Errors**: Run `bunx tsc --noEmit` before committing
3. **Database Changes**: Always generate AND apply migrations
4. **WebSocket Issues**: Check if port 3000 is already in use
5. **Build Failures**: Clear cache with `rm -rf .vite/ dist/`

## 🎯 Quick Wins

- Use `logger` from `shared/logger` for consistent logging
- Import components from `ui/styled/` for better TypeScript support
- Use React Query for all data fetching (no manual fetch calls)
- Prefer Drizzle query builder over raw SQL
- Always handle errors with proper error boundaries