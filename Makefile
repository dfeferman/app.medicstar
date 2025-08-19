include .env

docker_bin := $(shell command -v docker 2> /dev/null)
docker_compose_bin := $(docker_bin) compose
compose_config := --env-file=./.env

SOURCE_VOLUME := -v ./medicstar-app:/app

check:
	$(docker_compose_bin) $(compose_config) config
up: check
	$(docker_compose_bin) $(compose_config) up -d
down:
	$(docker_compose_bin) $(compose_config) down
ps:
	$(docker_compose_bin) $(compose_config) ps -a
run:
	$(docker_compose_bin) $(compose_config) stop remix
	$(docker_compose_bin) $(compose_config) run --rm $(SOURCE_VOLUME) -p 3000:3000 remix bash
	$(docker_compose_bin) $(compose_config) start remix