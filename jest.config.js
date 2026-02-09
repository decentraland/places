module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",
  fakeTimers: {
    enableGlobally: true,
  },
  moduleNameMapper: {
    "^decentraland-dapps/dist/modules/analytics/utils$":
      "<rootDir>/__mocks__/decentraland-dapps-analytics.js",
    "^isbot$": "<rootDir>/__mocks__/isbot.js",
    "^@dcl/ui-env$": "<rootDir>/src/__mocks__/@dcl/ui-env.ts",
    "^@dcl/ui-env/(.*)$": "<rootDir>/src/__mocks__/@dcl/ui-env.ts",
  },
}
