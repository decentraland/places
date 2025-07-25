module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",
  fakeTimers: {
    enableGlobally: true,
  },
  transformIgnorePatterns: [
    "node_modules/(?!(decentraland-dapps|decentraland-gatsby|isbot)/)",
  ],
}
