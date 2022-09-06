/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require("sharp")
sharp.cache(false)
sharp.simd(false)

// You can delete this file if you're not using it
exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    resolve: {
      fallback: {
        assert: false,
        crypto: false,
        http: false,
        https: false,
        os: false,
        stream: false,
        util: false,
      },
    },
  })
}
