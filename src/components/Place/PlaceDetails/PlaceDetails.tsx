import React, { useCallback, useMemo, useState } from "react"

import ReactMarkdown from "react-markdown"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"
import { intersects } from "radash/dist/array"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import Places from "../../../api/Places"
import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { FeatureFlags } from "../../../modules/ff"
import locations from "../../../modules/locations"
import { getPois } from "../../../modules/pois"
import RatingButton from "../../Button/RatingButton"
import ConfirmRatingModal from "../../Modal/ConfirmRatingModal"
import ContentModerationModal from "../../Modal/ContentModerationModal"
import PlaceStats from "../PlaceStats/PlaceStats"

import "./PlaceDetails.css"

export type PlaceDetailsProps = {
  place: AggregatePlaceAttributes
  loading: boolean
}

export enum PlaceDetailsTab {
  About = "About",
  ContentModeration = "Content Moderation",
}

export default React.memo(function PlaceDetails(props: PlaceDetailsProps) {
  const { place, loading } = props
  const l = useFormatMessage()
  const [pois] = useAsyncMemo(getPois)
  const [activeTab, setActiveTab] = useState(PlaceDetailsTab.About)
  const [openContentModerationModal, setOpenContentModerationModal] =
    useState(false)
  const [openConfirmModal, setOpenConfirmModal] = useState(false)
  const [selectedRate, setSelectedRate] = useState<
    SceneContentRating | boolean
  >(false)

  const [ff] = useFeatureFlagContext()
  const [account] = useAuthContext()
  const admin = isAdmin(account)

  const rating = useMemo(
    () => place?.content_rating?.toLocaleUpperCase() || SceneContentRating.TEEN,
    [place]
  )

  const isPoi = useMemo(
    () => intersects(place?.positions || [], pois || []),
    [place, pois]
  )

  const handleRatingButton = useCallback(
    (e: React.MouseEvent<any>, rating: SceneContentRating) => {
      e.stopPropagation()
      e.preventDefault()
      setSelectedRate(rating)
      const data = new Set(Object.values(SceneContentRating))
      const placeRating = data.has(place.content_rating)
        ? place.content_rating
        : SceneContentRating.TEEN
      if (placeRating !== rating) {
        setOpenContentModerationModal(true)
      }
    },
    [place, setSelectedRate, setOpenContentModerationModal]
  )

  const handleChangeRating = useCallback(
    async (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      e.preventDefault()
      if (typeof selectedRate === "boolean") return

      setOpenContentModerationModal(false)

      await Places.get().updateRating(place.id, {
        content_rating: selectedRate as SceneContentRating,
      })

      setOpenConfirmModal(true)
    },
    [place, selectedRate, setOpenContentModerationModal, setOpenConfirmModal]
  )

  const handleConfirmRating = useCallback(
    (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      e.preventDefault()

      navigate(locations.place(place.id))
    },
    [place]
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
          {admin && !ff.flags[FeatureFlags.HideRating] && (
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
          <PlaceStats place={place} loading={loading} poi={isPoi} />
        </>
      )}
      {admin && activeTab === PlaceDetailsTab.ContentModeration && (
        <div className="place-details__content-moderation-container">
          <h3>{l("components.place_detail.rate_label")}</h3>
          <div className="place-details__rating-box-container">
            <RatingButton
              rating={SceneContentRating.TEEN}
              current={
                rating !== SceneContentRating.ADULT &&
                rating !== SceneContentRating.RESTRICTED
              }
              active={
                (!selectedRate &&
                  rating !== SceneContentRating.ADULT &&
                  rating !== SceneContentRating.RESTRICTED) ||
                selectedRate === SceneContentRating.TEEN
              }
              onClick={(e) => handleRatingButton(e, SceneContentRating.TEEN)}
            />
            <RatingButton
              rating={SceneContentRating.ADULT}
              current={rating === SceneContentRating.ADULT}
              active={
                (!selectedRate && rating === SceneContentRating.ADULT) ||
                selectedRate === SceneContentRating.ADULT
              }
              onClick={(e) => handleRatingButton(e, SceneContentRating.ADULT)}
            />
            <RatingButton
              rating={SceneContentRating.RESTRICTED}
              current={rating === SceneContentRating.RESTRICTED}
              active={
                (!selectedRate && rating === SceneContentRating.RESTRICTED) ||
                selectedRate === SceneContentRating.RESTRICTED
              }
              onClick={(e) =>
                handleRatingButton(e, SceneContentRating.RESTRICTED)
              }
            />
          </div>
        </div>
      )}
      {admin && selectedRate && typeof selectedRate !== "boolean" && (
        <ContentModerationModal
          onClickOpen={(e, action) => setOpenContentModerationModal(action)}
          place={place}
          open={openContentModerationModal}
          selectedRate={selectedRate}
          onChangeRating={handleChangeRating}
        />
      )}
      {admin && selectedRate && typeof selectedRate !== "boolean" && (
        <ConfirmRatingModal
          open={openConfirmModal}
          selectedRate={selectedRate}
          sceneName={place.title!}
          onConfirmRating={handleConfirmRating}
        />
      )}
    </div>
  )
})
