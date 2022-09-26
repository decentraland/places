import React from "react"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Link from "decentraland-gatsby/dist/plugins/intl/Link"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"

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
    <Tabs>
      <Link href={locations.home()}>
        <Tabs.Tab active={props.activeTab === NavigationTab.Overview}>
          {l("navigation.overview")}
        </Tabs.Tab>
      </Link>
      <Link href={locations.places({})}>
        <Tabs.Tab active={props.activeTab === NavigationTab.Places}>
          {l("navigation.places")}
        </Tabs.Tab>
      </Link>
      {account && (
        <Link href={locations.my_places()}>
          <Tabs.Tab active={props.activeTab === NavigationTab.MyPlaces}>
            {l("navigation.my_places")}
          </Tabs.Tab>
        </Link>
      )}
    </Tabs>
  )
}
