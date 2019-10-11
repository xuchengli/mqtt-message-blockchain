stop:
	@docker-compose stop
	@docker-compose rm -f

start:
	@docker-compose up -d --build

logs:
	@docker-compose logs -f --tail=200
