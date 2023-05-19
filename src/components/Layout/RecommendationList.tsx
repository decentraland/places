import React from "react"

// import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { Atlas } from "decentraland-ui/dist/components/Atlas/Atlas"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import locations from "../../modules/locations"
// import feedTiles from "../../../utils/tiles"

import "./CategoryList.css"

export type Category = {
  createdAt: string
  name: string
  places: string[]
  updatedAt: string
  _id: string
}

export type CategoryListProps = {
  recommendations: any
}

export default React.memo(function RecommendationList(
  props: CategoryListProps
) {
  const { recommendations } = props
  const l = useFormatMessage()

  const recommendationsToDisplay: Category[] = recommendations.filter(
    (_: Category, index: number) => index < 4
  )

  return (
    <div className="ui category-list">
      <Container className="full">
        <HeaderMenu>
          <HeaderMenu.Left>
            <Header>{l("navigation.recommendations")}</Header>
          </HeaderMenu.Left>
          <HeaderMenu.Right>
            <Button
              basic
              as="a"
              href={locations.recommendations()}
              onClick={(e) => {
                e.preventDefault()
                navigate(locations.recommendations())
              }}
            >
              {l("components.overview_list.view_all")}
              <Icon name="chevron right" className="overview-list__view-all" />
            </Button>
          </HeaderMenu.Right>
        </HeaderMenu>
      </Container>
      <Container
        className="full"
        style={{ display: "flex", flexDirection: "row", gap: "20px" }}
      >
        {recommendationsToDisplay.map((recommendation: any, index: number) => {
          return (
            <div
              key={index}
              style={{
                display: " flex",
                flexDirection: "column",
                padding: " 0px",
                border: "none",
                boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.1)",
                borderRadius: "10px",
                width: "300px",
                backgroundColor: "white",
                height: "360px",
              }}
            >
              <div
                style={{
                  height: "300px",
                  width: "300px",
                  borderRadius: "10px",
                }}
              >
                <Atlas
                  zoom={0.1}
                  height={300}
                  width={300}
                  x={recommendation.source.point.x}
                  y={recommendation.source.point.y}
                />
              </div>
              <span
                style={{
                  display: "flex",
                  fontSize: "18px",
                  fontWeight: 600,
                  padding: "10px",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Button
                  basic
                  style={{
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "underline",
                    textUnderlineOffset: "4px",
                  }}
                  target="_blank"
                  href={`https://play.decentraland.org/?realm=marvel&position=${recommendation.source.point.x}%2C${recommendation.source.point.x}&island=Icq23`}
                >
                  {recommendation.display.title}
                </Button>
              </span>
            </div>
          )
        })}
      </Container>
    </div>
  )
})
