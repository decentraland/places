import React from "react"

import NavigationMenu from "decentraland-gatsby/dist/components/Layout/NavigationMenu"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { PlaceListOrderBy } from "../../entities/Place/types"
import locations from "../../modules/locations"

export enum NavigationTab {
  Overview = "overview",
  Places = "places",
  MyPlaces = "my_places",
}

export type NavigationProps = {
  activeTab?: NavigationTab
}

export default function Navigation(props: NavigationProps) {
  const l = useFormatMessage()
  const [account] = useAuthContext()

  return (
    <NavigationMenu
      isFullScreen={true}
      leftMenu={
        <>
          <NavigationMenu.Item
            active={props.activeTab === NavigationTab.Overview}
            href={locations.home()}
          >
            {l("navigation.overview")}
          </NavigationMenu.Item>
          <NavigationMenu.Item
            active={props.activeTab === NavigationTab.Places}
            href={locations.places({
              order_by: PlaceListOrderBy.HIGHEST_RATED,
            })}
          >
            {l("navigation.places")}
          </NavigationMenu.Item>
          {account && (
            <NavigationMenu.Item
              active={props.activeTab === NavigationTab.MyPlaces}
              href={locations.my_places({})}
            >
              {l("navigation.my_places")}
            </NavigationMenu.Item>
          )}
        </>
      }
    />
  )
}
