/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */

// You can delete this file if you're not using it
import React from "react"
import "core-js/features/set-immediate"

import "./src/config"

// eslint-disable-next-line css-import-order/css-import-order
import "semantic-ui-css/semantic.min.css"
// eslint-disable-next-line css-import-order/css-import-order
import "balloon-css/balloon.min.css"
// eslint-disable-next-line css-import-order/css-import-order
import "decentraland-ui/dist/themes/base-theme.css"
// eslint-disable-next-line css-import-order/css-import-order
import "decentraland-ui/dist/themes/alternative/light-theme.css"
// eslint-disable-next-line css-import-order/css-import-order
import "decentraland-gatsby/dist/variables.css"
// eslint-disable-next-line css-import-order/css-import-order
import "./src/theme.css"

import Layout from "decentraland-gatsby/dist/components/Layout/Layout"
import Layout2 from "decentraland-gatsby/dist/components/Layout/Layout2"
import UserInformation from "decentraland-gatsby/dist/components/User/UserInformation"
import AuthProvider from "decentraland-gatsby/dist/context/Auth/AuthProvider"
import FeatureFlagProvider from "decentraland-gatsby/dist/context/FeatureFlag/FeatureFlagProvider"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import ShareProvider from "decentraland-gatsby/dist/context/Share/ShareProvider"
import { IntlProvider } from "decentraland-gatsby/dist/plugins/intl"
import segment from "decentraland-gatsby/dist/utils/development/segment"
import env from "decentraland-gatsby/dist/utils/env"

import { TrackingPlacesSearchProvider } from "./src/context/TrackingContext"

export const registerServiceWorker = () => true

const ssoUrl = env("SSO_URL")

export const wrapRootElement = ({ element }) => (
  <AuthProvider sso={ssoUrl}>
    <TrackingPlacesSearchProvider>
      <FeatureFlagProvider applicationName={["places", "dapps"]}>
        <ShareProvider>{element}</ShareProvider>
      </FeatureFlagProvider>
    </TrackingPlacesSearchProvider>
  </AuthProvider>
)

export const wrapPageElement = ({ element, props }) => {
  const [ff] = useFeatureFlagContext()
  const isNewMenu = ff.flags["dapps-navbar2_variant"]

  return (
    <IntlProvider {...props.pageContext.intl}>
      {!isNewMenu && (
        <Layout {...props} rightMenu={<UserInformation />} activePage="places">
          {element}
        </Layout>
      )}
      {isNewMenu && (
        <Layout2 {...props} activePage="explore">
          {element}
        </Layout2>
      )}
    </IntlProvider>
  )
}

export const onClientEntry = () => {
  segment((analytics) => analytics.page())
}

export const onRouteUpdate = () => {
  segment((analytics) => analytics.page())
}

export const shouldUpdateScroll = ({ prevRouterProps, routerProps }) => {
  if (prevRouterProps?.location?.pathname === routerProps?.location?.pathname) {
    return false
  }

  return true
}

eval("Math.pow = (a, b) => a ** b")
