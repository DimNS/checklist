.PHONY: install ai-check typecheck format lint test dev build release

install:
	@bun install

# Единая команда для ии-агента
ai-check: typecheck lint test
	@git diff --exit-code -- ./package.json || { echo "❌ Изменения в package.json — остановись и попроси человека посмотреть твои изменения"; exit 1; }

typecheck:
	@bun run typecheck

format:
	@bun run format

lint: format
	@bun run lint

test:
	@bun run test

dev: build
	@bun run dev

build:
	@bun run build

release:
	@./scripts/release.sh $(if $(DRY_RUN),--dry-run)
