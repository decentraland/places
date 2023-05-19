import React from "react"

// import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import locations from "../../modules/locations"

import "./CategoryList.css"

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

export default React.memo(function CategoryList(props: CategoryListProps) {
  const { categories } = props
  const l = useFormatMessage()

  const categoriesToDisplay: Category[] = categories.filter(
    (_: Category, index: number) => index < 12
  )

  console.log("categoriesToDisplay: ", categoriesToDisplay)

  return (
    <div className="ui category-list">
      <Container className="full">
        <HeaderMenu>
          <HeaderMenu.Left>
            <Header>{l("pages.overview.categories")}</Header>
          </HeaderMenu.Left>
          <HeaderMenu.Right>
            <Button
              basic
              as="a"
              href={locations.categories()}
              onClick={(e) => {
                e.preventDefault()
                navigate(locations.categories())
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
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {categoriesToDisplay.map((category: any, index: number) => {
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
      </Container>
    </div>
  )
})
