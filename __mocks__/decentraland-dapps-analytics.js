// Mock for decentraland-dapps analytics utils
module.exports = {
  track: () => {},
  analyticsInitialize: () => {},
  getAnalytics: () => ({
    track: () => {},
    page: () => {},
    identify: () => {},
  }),
}
