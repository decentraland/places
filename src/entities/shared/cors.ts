export const API_CORS_ORIGINS: RegExp[] = [
  /^https?:\/\/localhost(?::\d{4,6})?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d{4,6})?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d{4,6})?$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*dcl\.gg$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*decentraland\.systems$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*decentraland\.today$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*decentraland\.zone$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*decentraland\.org$/,
  /^https:\/\/decentraland\.github\.io$/,
  /^https:\/\/(?:[a-zA-Z0-9_-]+\.)*pages\.dev$/,
  /^https:\/\/[a-zA-Z0-9_-]+-decentraland1\.vercel\.app$/,
]
