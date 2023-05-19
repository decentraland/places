import React from "react"

import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import RecomendationPage from "../components/Layout/RecomendationPage"
import { useGetRecommendations } from "../hooks/useGetRecomendations"
import { FeatureFlags } from "../modules/ff"

export default function CategoriesPage() {
  const l = useFormatMessage()

  const [ff] = useFeatureFlagContext()

  const [recommendations] = useGetRecommendations()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  return (
    <>
      <Navigation activeTab={NavigationTab.Recommendations} />
      <Container className="my-places-list__container">
        <Header>{l("navigation.recommendations")}</Header>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <RecomendationPage recommendations={recommendations} />
        </div>
      </Container>
    </>
  )
}
