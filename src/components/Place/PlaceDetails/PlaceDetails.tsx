import React, { useCallback, useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import { intersects } from "radash"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import {
  AggregatePlaceAttributes,
  PlaceListOrderBy,
} from "../../../entities/Place/types"
import locations from "../../../modules/locations"
import { getPois } from "../../../modules/pois"
import { getRating } from "../../../modules/rating"
import RatingButton, { RatingButtonProps } from "../../Button/RatingButton"
import AppearsOnCategory from "../../Category/AppearsOnCategory"
import { CategoryFilterProps } from "../../Category/CategoryFilter"
import PlaceStats from "../PlaceStats/PlaceStats"

import "./PlaceDetails.css"

export type PlaceDetailsProps = Pick<RatingButtonProps, "onChangeRating"> & {
  place: AggregatePlaceAttributes
  loading: boolean
}

export enum PlaceDetailsTab {
  About = "About",
  ContentModeration = "Content Moderation",
}

export default React.memo(function PlaceDetails(props: PlaceDetailsProps) {
  const { onChangeRating, place, loading } = props
  const l = useFormatMessage()
  const [pois] = useAsyncMemo(getPois)
  const [activeTab, setActiveTab] = useState(PlaceDetailsTab.About)

  const [account] = useAuthContext()
  const admin = isAdmin(account)

  const rating = useMemo(
    () => getRating(place?.content_rating, SceneContentRating.RATING_PENDING),
    [place]
  )

  const isPoi = useMemo(
    () => intersects(place?.positions || [], pois || []),
    [place, pois]
  )

  const handleCategorySelect = useCallback(
    (
      e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
      props: CategoryFilterProps
    ) => {
      const { category } = props

      navigate(
        locations.genesis({
          categories: [category],
          order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
        })
      )
    },
    []
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
          {admin && (
            <Tabs.Tab
              onClick={() => setActiveTab(PlaceDetailsTab.ContentModeration)}
              active={activeTab === PlaceDetailsTab.ContentModeration}
            >
              {l("components.place_detail.content_moderation")}{" "}
              <Icon name="eye" />
            </Tabs.Tab>
          )}
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

          {place?.categories.length > 0 && (
            <AppearsOnCategory
              categories={place.categories}
              onSelectCategory={handleCategorySelect}
            />
          )}
          <PlaceStats place={place} loading={loading} poi={isPoi} />
        </>
      )}
      {admin && activeTab === PlaceDetailsTab.ContentModeration && (
        <div className="place-details__content-moderation-container">
          <h3>{l("components.place_detail.rate_label")}</h3>
          <div className="place-details__rating-box-container">
            <RatingButton
              rating={SceneContentRating.TEEN}
              active={rating === SceneContentRating.TEEN}
              onChangeRating={onChangeRating}
            />
            <RatingButton
              rating={SceneContentRating.ADULT}
              active={rating === SceneContentRating.ADULT}
              onChangeRating={onChangeRating}
            />
            <RatingButton
              rating={SceneContentRating.RESTRICTED}
              active={rating === SceneContentRating.RESTRICTED}
              onChangeRating={onChangeRating}
            />
          </div>
        </div>
      )}
    </div>
  )
})
