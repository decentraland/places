import dotenv from "dotenv"

// Load local overrides first so dotenv preserves the precedence used by the
// service: process environment > .env.development > .env.default.
dotenv.config({ path: ".env.development" })
dotenv.config({ path: ".env.default" })
