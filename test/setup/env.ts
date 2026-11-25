// The worlds servers the handlers may read from; integration tests mock the requests themselves.
process.env.WORLDS_CONTENT_SERVER_URL ||=
  "https://worlds-content-server.decentraland.org"
process.env.ALLOWED_CONTENT_SERVER_HOSTS ||=
  "worlds-content-server.decentraland.org"
process.env.ALLOWED_WORLDS_CONTENT_SERVER_HOSTS ||= "worlds.example.org"
