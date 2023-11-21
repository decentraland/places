import React from "react"

import NavigationMenu from "decentraland-gatsby/dist/components/Layout/NavigationMenu"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { PlaceListOrderBy } from "../../entities/Place/types"
import { WorldListOrderBy } from "../../entities/World/types"
import { FeatureFlags } from "../../modules/ff"
import locations from "../../modules/locations"
import { OpenBlank } from "../Icon/OpenBlank"

import "./Navigation.css"

export enum NavigationTab {
  Overview = "overview",
  Places = "places",
  Worlds = "worlds",
  Favorites = "favorites",
}

export type NavigationProps = {
  activeTab?: NavigationTab
}

export default function Navigation(props: NavigationProps) {
  const l = useFormatMessage()
  const [account] = useAuthContext()
  const track = useTrackLinkContext()
  const [ff] = useFeatureFlagContext()

  return (
    <NavigationMenu
      isFullScreen={true}
      className="navigation-menu__parent"
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
            href={locations.genesis({
              order_by: PlaceListOrderBy.MOST_ACTIVE,
            })}
          >
            {l("navigation.places")}
          </NavigationMenu.Item>
          {!ff.flags[FeatureFlags.HideWorlds] && (
            <NavigationMenu.Item
              active={props.activeTab === NavigationTab.Worlds}
              href={locations.worlds({
                order_by: WorldListOrderBy.LIKE_SCORE_BEST,
              })}
            >
              {l("navigation.worlds")}
            </NavigationMenu.Item>
          )}
          {account && (
            <NavigationMenu.Item
              active={props.activeTab === NavigationTab.Favorites}
              href={locations.favorites()}
            >
              {l("navigation.favorites")}
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
