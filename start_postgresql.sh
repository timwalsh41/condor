#!/bin/bash
docker exec -it -u postgres opencode-condor /bin/zsh -c "service postgresql start"
