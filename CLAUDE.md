# CLAUDE.md - HamFlow Documentation Hub

Welcome to the HamFlow project! This index helps Claude Code (and developers) navigate our comprehensive documentation system.

## 🎯 Start Here

**New to the project?** Follow this order:
1. 📊 [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) - Current state and progress
2. 🚀 [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) - Critical reminders and commands
3. 🤖 [CLAUDE_WORKFLOW.md](docs/CLAUDE_WORKFLOW.md) - Claude Code specific workflow
4. 📖 [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) - Coding standards and practices

## 📚 Documentation Structure

### 🔧 Core Documentation

| Document | Purpose | Update Frequency |
|----------|---------|-----------------|
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Feature tracking, blockers, progress | Every session |
| [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) | Commands, patterns, code snippets | As needed |
| [CLAUDE_WORKFLOW.md](docs/CLAUDE_WORKFLOW.md) | Claude Code task execution guide | When workflow changes |
| [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | UI patterns, styling, conventions | When patterns emerge |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Bug solutions, debugging steps | When issues fixed |

### 🏗️ Architecture & Stack

| Document | Purpose | Update Frequency |
|----------|---------|-----------------|
| [TECH_STACK.md](docs/TECH_STACK.md) | Technologies, architecture, real-time patterns | When stack changes |
| [design_document.md](design_document.md) | Original requirements and specs | Rarely |

### 📅 Maintenance

| Document | Purpose | Update Frequency |
|----------|---------|-----------------|
| [MAINTENANCE_SCHEDULE.md](docs/MAINTENANCE_SCHEDULE.md) | Documentation maintenance guide | Monthly review |

## ⚡ Quick Actions

### Starting Work
```bash
# 1. Check project status
cat docs/PROJECT_STATUS.md

# 2. Start dev server (PORT 3000!)
bun run dev

# 3. Open browser
open http://localhost:3000
```

### Before Committing
```bash
# 1. Check types
bunx tsc --noEmit

# 2. Fix linting
bun run lint:fix

# 3. Run tests
bun test

# 4. Update docs if needed
```

## 🔥 Most Critical Reminders

1. **PORT 3000** - NOT 5173! Dev server: `http://localhost:3000`
2. **No `any` types** - Always use proper TypeScript types
3. **Use TodoWrite** - Track multi-step tasks with the tool
4. **Update docs** - Keep documentation current with changes
5. **Test first** - Never commit without testing

## 📊 Documentation Health Status

| Area | Status | Last Updated |
|------|--------|--------------|
| Project Status | 🟢 Active | Daily |
| Development Guide | 🟢 Current | Weekly |
| Troubleshooting | 🟢 Current | As needed |
| Tech Stack | 🟢 Current | Monthly |
| Quick Reference | 🟢 Current | As needed |

## 🚀 Quick Links

- **Development**: http://localhost:3000
- **Database Studio**: http://localhost:4983
- **API Docs**: http://localhost:3000/swagger
- **Sample Code**: `.sample_code_do_not_copy/`

## 📝 When to Update Documentation

| Event | Action | File |
|-------|--------|------|
| Task completed | Update status | PROJECT_STATUS.md |
| Bug fixed | Add solution (with code) | TROUBLESHOOTING.md |
| UI pattern discovered | Document pattern | DEVELOPMENT_GUIDE.md |
| Workflow changed | Update guide | DEVELOPMENT_GUIDE.md |
| Architecture decision | Document with rationale | TECH_STACK.md |
| Dependency added | Update stack info | TECH_STACK.md |
| Code snippet useful | Add to quick ref | QUICK_REFERENCE.md |

---

💡 **Pro Tip**: Use `TodoWrite` tool to track documentation updates alongside code changes!