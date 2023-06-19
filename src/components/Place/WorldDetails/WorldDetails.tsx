import React, { useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import { intersects, sum } from "radash/dist/array"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { getPois } from "../../../modules/pois"
import { getServers } from "../../../modules/servers"
import { RealmActivity } from "../PlaceRealmActivity/PlaceRealmActivity"
import PlaceStats from "../PlaceStats/PlaceStats"

import "./WorldDetails.css"

export type WorldDetailsProps = {
  place: AggregatePlaceAttributes
  loading: boolean
}

export enum WorldDetailsTab {
  About = "About",
  Realms = "Realms",
}

export default React.memo(function WorldDetails(props: WorldDetailsProps) {
  const { place, loading } = props
  const l = useFormatMessage()
  const [servers] = useAsyncMemo(getServers)
  const [activeTab, setActiveTab] = useState(WorldDetailsTab.About)

  const placeRealmActivities: RealmActivity[] = useMemo(() => {
    if (place && servers) {
      const positions = new Set(place.positions)
      return servers
        .filter((server) => server.status)
        .map((server) => {
          let peersCount: number[] = []
          if (server.stats) {
            peersCount = server.stats.parcels.map((parcel) => {
              const isParcelInPlace = positions.has(
                `${parcel.parcel.x},${parcel.parcel.y}`
              )
              if (isParcelInPlace) {
                return parcel.peersCount
              } else {
                return 0
              }
            })
          }

          return {
            name: server.status!.name,
            activity: sum(peersCount, (number) => number),
          }
        })
    } else {
      return []
    }
  }, [place, servers])

  const activitySum = useMemo(
    () => sum(placeRealmActivities, (f) => f.activity),
    [placeRealmActivities]
  )

  return (
    <div
      className={TokenList.join([
        "world-details__container",
        loading && "loading",
      ])}
    >
      <Tabs>
        <Tabs.Left>
          <Tabs.Tab
            onClick={() => setActiveTab(WorldDetailsTab.About)}
            active={activeTab === WorldDetailsTab.About}
          >
            {l("components.place_detail.about")}
          </Tabs.Tab>
        </Tabs.Left>
      </Tabs>
      {activeTab === WorldDetailsTab.About && (
        <>
          <div className="world-details__description-container">
            {place?.description && (
              <>
                <h3>{l("components.place_detail.description")}</h3>
                <div>
                  <ReactMarkdown
                    children={place?.description}
                    rehypePlugins={[rehypeSanitize]}
                    remarkPlugins={[remarkGfm]}
                  />
                </div>
              </>
            )}
            <h3>{l("components.place_detail.location")}</h3>
            <div>
              <Label>
                <Icon name="map marker alternate" /> {place?.world_name}
              </Label>
            </div>
          </div>
          <PlaceStats
            place={place}
            users={activitySum}
            loading={loading}
            poi={false}
          />
        </>
      )}
    </div>
  )
})
