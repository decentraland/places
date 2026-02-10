// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require("./jest.config")

module.exports = {
  ...baseConfig,
  fakeTimers: {
    enableGlobally: false,
  },
  setupFiles: ["<rootDir>/test/setup/mocks.ts"],
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
  testTimeout: 30000,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
}
