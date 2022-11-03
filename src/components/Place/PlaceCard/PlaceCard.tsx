import React, { useCallback, useMemo } from "react"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import useUserAgentData from "decentraland-gatsby/dist/hooks/useUserAgentData"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Card } from "decentraland-ui/dist/components/Card/Card"
import { useTabletAndBelowMediaQuery } from "decentraland-ui/dist/components/Media/Media"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { placeTargetUrl } from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import FavoriteButton from "../../Button/FavoriteButton"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import UserCount from "../../Label/UserCount/UserCount"
import UserLikePercentage from "../../Label/UserLikePercentage/UserLikePercentage"

import "./PlaceCard.css"

export type PlaceCardProps = {
  place?: AggregatePlaceAttributes
  onClickFavorite?: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  dataPlace?: SegmentPlace
  loading?: boolean
  loadingFavorites?: boolean
}

export default React.memo(function PlaceCard(props: PlaceCardProps) {
  const { place, loading, loadingFavorites, onClickFavorite, dataPlace } = props

  const handleClickFavorite = useCallback(
    (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      e.preventDefault()
      if (onClickFavorite && place) {
        onClickFavorite(e, place)
      }
    },
    [place, onClickFavorite]
  )

  const l = useFormatMessage()
  const isTabletOrMobile = useTabletAndBelowMediaQuery()
  const userAgentData = useUserAgentData()

  const href = useMemo(() => place && locations.place(place.id), [place])

  const placerUrl = place && placeTargetUrl(place)

  const handleJumpInTrack = useTrackLinkContext()

  return (
    <Card
      as="div"
      className={TokenList.join([
        "place-card",
        loading && "loading",
        !loading && !place && "hidden",
      ])}
    >
      <a
        className="place-card__cover"
        href={href}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault()
          href && navigate(href)
        }}
      >
        <ImgFixed src={place?.image || ""} dimension="wide" />
      </a>
      <Card.Content>
        <Card.Header
          as="a"
          href={href}
          onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            href && navigate(href)
          }}
        >
          {place?.title || " "}
          <div className="place-card__stats">
            <UserLikePercentage
              loading={loading}
              value={place?.like_rate || 0}
            />
            <UserCount loading={loading} value={place?.user_count || 0} />
          </div>
        </Card.Header>
        <div className="place-card__button-container">
          {!(isTabletOrMobile || userAgentData.mobile) && (
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={place?.id}
              data-place={dataPlace}
            />
          )}
          {(isTabletOrMobile || userAgentData.mobile) && (
            <Button
              as="a"
              href={href}
              size="small"
              loading={loading}
              className="place-card__find-out"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault()
                href && navigate(href)
              }}
            >
              {l("components.button.find_out_more")}
            </Button>
          )}
          <FavoriteButton
            active={!!place?.user_favorite}
            onClick={handleClickFavorite}
            loading={loading || loadingFavorites}
            dataPlace={dataPlace}
          />
        </div>
      </Card.Content>
    </Card>
  )
})
