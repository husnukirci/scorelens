.PHONY: help install dev test typecheck lint build types

help: ## List all targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and git hooks
	npm install

dev: ## Start the dev server
	npm run dev

test: typecheck lint ## Local gates: typecheck + lint + tests with coverage
	npm run test

typecheck: ## TypeScript project check
	npm run typecheck

lint: ## ESLint (zero warnings) + Prettier check
	npm run lint
	npm run format:check

build: ## Production build
	npm run build

types: ## Regenerate src/api/types.gen.ts from the committed spec snapshot
	npm run types
