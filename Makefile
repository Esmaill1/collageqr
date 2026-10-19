.PHONY: test lint typecheck build db-migrate db-seed

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed
