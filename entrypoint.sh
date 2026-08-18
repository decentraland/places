#!/bin/sh
# ./node_modules/.bin/node-pg-migrate -m lib/migrations -d CONNECTION_STRING up && NODE_ENV=production node lib/server.js

#!/bin/sh

finish() {
  echo "killing service..."
  kill -SIGTERM "$pid" 2>/dev/null;
}

trap finish SIGINT SIGQUIT SIGTERM

echo "running migrations"
# The service must not start against a schema the code does not match: a missing column fails every
# world SQS message at runtime with nothing but a log line to say why.
if ! ./node_modules/.bin/node-pg-migrate -m lib/migrations -d CONNECTION_STRING up; then
  echo "migrations failed, refusing to start the service"
  exit 1
fi

echo "starting service..."
NODE_ENV=production node lib/server.js &

pid=$!
echo "runnig on $pid"
wait "$pid"