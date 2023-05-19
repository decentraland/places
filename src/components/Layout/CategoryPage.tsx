import React, { useState } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import locations from "../../modules/locations"

import "./OverviewList.css"

export type Category = {
  createdAt: string
  name: string
  places: string[]
  updatedAt: string
  _id: string
}

export type CategoryListProps = {
  categories: any
}

export default React.memo(function CategoryPage(props: CategoryListProps) {
  const { categories } = props

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
        {categories.map((category: any, index: number) => {
          return (
            <Button
              key={index}
              style={{
                display: " flex",
                flexDirection: "column",
                padding: " 15px",
                border: "none",
                boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.3)",
                borderRadius: "10px",
                width: "250px",
                backgroundColor: "white",
                overflow: "hidden",
              }}
              href={locations.category(category._id)}
            >
              <span>{category.name}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
})
