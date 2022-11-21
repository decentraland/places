import React from "react"

import NavigationMenu from "decentraland-gatsby/dist/components/Layout/NavigationMenu"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { PlaceListOrderBy } from "../../entities/Place/types"
import locations from "../../modules/locations"
import { OpenBlank } from "../Icon/OpenBlank"

import "./Navigation.css"

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
  const track = useTrackLinkContext()

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
          <NavigationMenu.Item
            active={false}
            href={l("navigation.faq_target")}
            onClick={track}
          >
            {l("navigation.faq")} <OpenBlank />
          </NavigationMenu.Item>
        </>
      }
    />
  )
}
