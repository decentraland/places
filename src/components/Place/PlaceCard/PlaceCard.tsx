import React, { useCallback, useMemo } from "react"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { placeTargetUrl } from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import FavoriteButton from "../../Button/FavoriteButton"
import JumpInPositionButton from "../../Button/JumpInPositionButton"

import "./PlaceCard.css"

export type PlaceCardProps = {
  place?: AggregatePlaceAttributes
  onClickFavorite?: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  loading?: boolean
  loadingFavorites?: boolean
}

export default React.memo(function PlaceCard(props: PlaceCardProps) {
  const { place, loading, loadingFavorites } = props

  const handleClickFavorite = useCallback(
    (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      e.preventDefault()
      if (props.onClickFavorite && place) {
        props.onClickFavorite(e, place)
      }
    },
    [place, props.onClickFavorite]
  )

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
      <a className="place-card__cover" href={href}>
        <ImgFixed src={place?.image || ""} dimension="wide" />
      </a>
      <Card.Content>
        <Card.Header as="a" href={href}>
          {place?.title || " "}
        </Card.Header>
        <div className="place-card__button-container">
          <JumpInPositionButton
            href={placerUrl}
            loading={loading}
            onClick={handleJumpInTrack}
            data-event={SegmentPlace.JumpIn}
            data-place-id={place?.id}
          />
          <FavoriteButton
            active={!!place?.user_favorite}
            onClick={handleClickFavorite}
            loading={loading || loadingFavorites}
          />
        </div>
      </Card.Content>
    </Card>
  )
})
