import React, { useState } from "react"

import ReactMarkdown from "react-markdown"

import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { FeatureFlags } from "../../../modules/ff"
import PlaceStats from "../../Place/PlaceStats/PlaceStats"

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
  const [activeTab, setActiveTab] = useState(WorldDetailsTab.About)

  const [ff] = useFeatureFlagContext()

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
            loading={loading}
            poi={false}
            hideUserCount={!!ff.flags[FeatureFlags.HideWorldActiveUser]}
          />
        </>
      )}
    </div>
  )
})
