import React, { useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import { intersects } from "radash/dist/array"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { getPois } from "../../../modules/pois"
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
  const [activeTab, setActiveTab] = useState(PlaceDetailsTab.About)

  const isPoi = useMemo(
    () => intersects(place?.positions || [], pois || []),
    [place, pois]
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
        </Tabs.Left>
      </Tabs>
      {activeTab === PlaceDetailsTab.About && (
        <>
          <div className="place-details__description-container">
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
                <Icon name="map marker alternate" /> {place?.base_position}
              </Label>
            </div>
          </div>
          <PlaceStats place={place} loading={loading} poi={isPoi} />
        </>
      )}
    </div>
  )
})
