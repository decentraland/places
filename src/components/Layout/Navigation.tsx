import React, { useCallback, useMemo } from "react"

import { useLocation } from "@gatsbyjs/reach-router"
import NavigationMenu from "decentraland-gatsby/dist/components/Layout/NavigationMenu"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import debounce from "decentraland-gatsby/dist/utils/function/debounce"

import { PlaceListOrderBy } from "../../entities/Place/types"
import { WorldListOrderBy } from "../../entities/World/types"
import { FeatureFlags } from "../../modules/ff"
import locations from "../../modules/locations"
import { SegmentPlace } from "../../modules/segment"
import { OpenBlank } from "../Icon/OpenBlank"
import SearchInput from "./SearchInput"

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

  const location = useLocation()

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )

  const debounceTrack = useCallback(
    debounce((_search: string) => {
      // track(SegmentPlace.FilterChange, { search: search })
    }, 500),
    [track]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newParams = new URLSearchParams(params)
      if (e.target.value) {
        newParams.set("search", e.target.value)
      } else {
        newParams.delete("search")
      }

      debounceTrack(e.target.value)
      let target = location.pathname
      const search = newParams.toString()
      // location
      // navigate to /search+=?search=${search}
      if (search) {
        target += "?" + search
      }

      navigate(target)
    },
    [location.pathname, params, debounceTrack]
  )

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
            href={locations.places({
              order_by: PlaceListOrderBy.HIGHEST_RATED,
            })}
          >
            {l("navigation.places")}
          </NavigationMenu.Item>
          {!ff.flags[FeatureFlags.HideWorlds] && (
            <NavigationMenu.Item
              active={props.activeTab === NavigationTab.Worlds}
              href={locations.worlds({
                order_by: WorldListOrderBy.HIGHEST_RATED,
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
      rightMenu={
        <>
          <SearchInput
            placeholder={l(`navigation.search.${props.activeTab ?? "default"}`)}
            onChange={handleSearchChange}
            defaultValue={params.get("search") || ""}
          />
        </>
      }
    />
  )
}
