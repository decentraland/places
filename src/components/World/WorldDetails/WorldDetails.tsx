import React, { useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { FeatureFlags } from "../../../modules/ff"
import { getRating } from "../../../modules/rating"
import RatingButton from "../../Button/RatingButton"
import PlaceStats from "../../Place/PlaceStats/PlaceStats"

import "./WorldDetails.css"

export type WorldDetailsProps = {
  onChangeRating: (e: React.MouseEvent<any>, rating: SceneContentRating) => void
  place: AggregatePlaceAttributes
  loading: boolean
}

export enum WorldDetailsTab {
  About = "About",
  ContentModeration = "Content Moderation",
}

export default React.memo(function WorldDetails(props: WorldDetailsProps) {
  const { onChangeRating, place, loading } = props
  const l = useFormatMessage()
  const [activeTab, setActiveTab] = useState(WorldDetailsTab.About)

  const [ff] = useFeatureFlagContext()
  const [account] = useAuthContext()
  const admin = isAdmin(account)

  const rating = useMemo(
    () => getRating(place?.content_rating, SceneContentRating.RATING_PENDING),
    [place]
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
          {admin && !ff.flags[FeatureFlags.HideRating] && (
            <Tabs.Tab
              onClick={() => setActiveTab(WorldDetailsTab.ContentModeration)}
              active={activeTab === WorldDetailsTab.ContentModeration}
            >
              {l("components.place_detail.content_moderation")}{" "}
              <Icon name="eye" />
            </Tabs.Tab>
          )}
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
      {admin && activeTab === WorldDetailsTab.ContentModeration && (
        <div className="place-details__content-moderation-container">
          <h3>{l("components.place_detail.rate_label")}</h3>
          <div className="place-details__rating-box-container">
            <RatingButton
              rating={SceneContentRating.TEEN}
              active={rating === SceneContentRating.TEEN}
              onClick={(e) => onChangeRating(e, SceneContentRating.TEEN)}
            />
            <RatingButton
              rating={SceneContentRating.ADULT}
              active={rating === SceneContentRating.ADULT}
              onClick={(e) => onChangeRating(e, SceneContentRating.ADULT)}
            />
            <RatingButton
              rating={SceneContentRating.RESTRICTED}
              active={rating === SceneContentRating.RESTRICTED}
              onClick={(e) => onChangeRating(e, SceneContentRating.RESTRICTED)}
            />
          </div>
        </div>
      )}
    </div>
  )
})
