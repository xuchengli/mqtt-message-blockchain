stop:
	@docker-compose down

start:
	@docker-compose up -d --build

logs:
	@docker-compose logs -f --tail=200
