import React from "react"

import { Atlas } from "decentraland-ui/dist/components/Atlas/Atlas"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import "./OverviewList.css"

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

export default React.memo(function RecommendationPage(
  props: CategoryListProps
) {
  const { recommendations } = props

  return (
    <div className="ui category-list">
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        {recommendations.map((recommendation: any, index: number) => {
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
      </div>
    </div>
  )
})
