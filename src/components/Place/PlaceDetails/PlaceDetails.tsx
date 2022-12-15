import React, { useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import { intersects, sum } from "radash/dist/array"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { getPois } from "../../../modules/pois"
import { getServers } from "../../../modules/servers"
import PlaceRealmActivity, {
  ReamlActivity,
} from "../PlaceRealmActivity/PlaceRealmActivity"
import PlaceStats from "../PlaceStats/PlaceStats"

import "./PlaceDetails.css"

export type PlaceDetailsProps = {
  place: AggregatePlaceAttributes
  loading: boolean
}

export enum PlaceDetailsTab {
  About = "About",
  Realms = "Realms",
}

export default React.memo(function PlaceDetails(props: PlaceDetailsProps) {
  const { place, loading } = props
  const l = useFormatMessage()
  const [pois] = useAsyncMemo(getPois)
  const [servers] = useAsyncMemo(getServers)
  const [activeTab, setActiveTab] = useState(PlaceDetailsTab.About)

  const isPoi = useMemo(
    () => intersects(place?.positions || [], pois || []),
    [place, pois]
  )

  const placeRealmActivities: ReamlActivity[] = useMemo(() => {
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
        "place-details__container",
        loading && "loading",
      ])}
    >
      <Tabs>
        <Tabs.Left>
          <Tabs.Tab
            onClick={() => setActiveTab(PlaceDetailsTab.About)}
            active={activeTab === PlaceDetailsTab.About}
          >
            {l("components.place_detail.about")}
          </Tabs.Tab>
          {/* TODO: decide what to do with it
          placeRealmActivities.length > 0 && (
            <Tabs.Tab
              onClick={() => setActiveTab(PlaceDetailsTab.Realms)}
              active={activeTab === PlaceDetailsTab.Realms}
            >
              {l("components.place_detail.realms")}
            </Tabs.Tab>
          ) */}
        </Tabs.Left>
      </Tabs>
      {activeTab === PlaceDetailsTab.About && (
        <>
          <div className="place-details__description-container">
            {place?.description && (
              <>
                <h3>{l("components.place_detail.description")}</h3>
                <div>
                  <p>
                    <ReactMarkdown
                      children={place?.description}
                      rehypePlugins={[rehypeRaw]}
                      remarkPlugins={[remarkGfm]}
                    />
                  </p>
                </div>
              </>
            )}
            <h3>{l("components.place_detail.location")}</h3>
            <div>
              <Label>
                <Icon name="map marker alternate" /> {place?.base_position}
              </Label>
            </div>
          </div>
          <PlaceStats
            place={place}
            users={activitySum}
            loading={loading}
            poi={isPoi}
          />
        </>
      )}
      {/* TODO: decide what to do with it
      activeTab === PlaceDetailsTab.Realms &&
        placeRealmActivities.length > 0 && (
          <PlaceRealmActivity
            place={place}
            loading={loading}
            activities={placeRealmActivities}
          />
        ) */}
    </div>
  )
})
