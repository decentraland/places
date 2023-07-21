import React, { useCallback, useMemo } from "react"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import {
  explorerPlaceUrl,
  explorerWorldUrl,
} from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import FavoriteButton from "../../Button/FavoriteButton"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import UserCount from "../../Label/UserCount/UserCount"
import UserLikePercentage from "../../Label/UserLikePercentage/UserLikePercentage"
import UserPreviewCount from "../../Label/UserPreviewCount/UserPreviewCount"

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
  search?: string
}

export default React.memo(function PlaceCard(props: PlaceCardProps) {
  const track = useTrackContext()

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

  const href = useMemo(() => {
    if (place && !place.world) {
      return locations.place(place.base_position)
    } else if (place && place.world) {
      return locations.world(place.world_name!)
    }
  }, [place])

  const placerUrl = useMemo(() => {
    if (place && !place.world) {
      return explorerPlaceUrl(place)
    } else if (place && place.world) {
      return explorerWorldUrl(place)
    }
  }, [place])

  const handleClickCard = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (props.search) {
      track(SegmentPlace.PlaceCardClick, { place: place?.id })
    }

    href && navigate(href)
  }

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
      <a className="place-card__cover" href={href} onClick={handleClickCard}>
        <ImgFixed src={place?.image || ""} dimension="wide" />
        <div className="place-card__stats">
          <div className="place-card__stats-top">
            <UserCount loading={loading} value={place?.user_count || 0} />
          </div>
          <div className="place-card__stats-bottom">
            <UserPreviewCount
              loading={loading}
              value={place?.user_visits || 0}
            />
            <UserLikePercentage
              loading={loading}
              value={place?.like_rate || 0}
            />
          </div>
        </div>
      </a>
      <Card.Content>
        <Card.Header as="a" href={href} onClick={handleClickCard}>
          {place?.title || " "}
        </Card.Header>
        <Card.Meta as="a" href={href} onClick={handleClickCard}>
          {place?.contact_name || " "}
        </Card.Meta>
        {false && (
          /* hidden for now */
          <div className="place-card__button-container">
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={place?.id}
              data-place={dataPlace}
            />
            <FavoriteButton
              active={!!place?.user_favorite}
              onClick={handleClickFavorite}
              loading={loading || loadingFavorites}
              dataPlace={dataPlace}
            />
          </div>
        )}
      </Card.Content>
    </Card>
  )
})
