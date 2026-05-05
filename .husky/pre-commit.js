module.exports = {
  "**/*.{js,ts}": [
    "jest --bail --watchAll=false --findRelatedTests --passWithNoTests",
    () => "tsc-files --noEmit",
  ],
  "**/*.{ts,js,json,md,yml,yaml}": ["prettier --write"],
  "*.{js,ts}": ["eslint --fix"],
}
