.PHONY: help
help: ## Show this help message
	@echo "HamFlow Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Initial setup for local development
	@echo "Setting up HamFlow for local development..."
	@cp .env.local.example .env.local 2>/dev/null || true
	@bun install
	@make db-up
	@sleep 3
	@make db-setup
	@echo "Setup complete! Run 'make dev' to start development."

.PHONY: dev
dev: ## Start development servers (requires docker-compose up)
	@echo "Starting development servers..."
	@make db-up
	@bun run dev

.PHONY: build
build: ## Build production assets
	@bun run build

.PHONY: db-up
db-up: ## Start PostgreSQL with Docker Compose
	@echo "Starting PostgreSQL..."
	@docker-compose up -d postgres

.PHONY: db-down
db-down: ## Stop PostgreSQL
	@echo "Stopping PostgreSQL..."
	@docker-compose down

.PHONY: db-setup
db-setup: ## Setup database (generate migrations and push)
	@echo "Setting up database..."
	@bun run db:generate
	@bun run db:push

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@bun run db:migrate

.PHONY: db-studio
db-studio: ## Open Drizzle Studio for database management
	@bun run db:studio

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys all data)
	@echo "Resetting database..."
	@docker-compose down -v
	@docker-compose up -d postgres
	@sleep 3
	@make db-setup

.PHONY: lint
lint: ## Run linter
	@bun run lint

.PHONY: lint-fix
lint-fix: ## Run linter with auto-fix
	@bun run lint:fix

.PHONY: test
test: ## Run tests (when implemented)
	@echo "Tests not yet implemented"

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	@rm -rf dist node_modules .vite styled-system
	@docker-compose down -v

.PHONY: logs
logs: ## Show docker-compose logs
	@docker-compose logs -f

.PHONY: ps
ps: ## Show running containers
	@docker-compose ps

.PHONY: shell-db
shell-db: ## Open PostgreSQL shell
	@docker-compose exec postgres psql -U postgres -d hamflow