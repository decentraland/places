import React, { useCallback, useMemo } from "react"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { placeTargetUrl } from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import FavoriteButton from "../../Button/FavoriteButton"
import JumpInPositionButton from "../../Button/JumpInPositionButton"

import "./PlaceCard.css"

export type PlaceCardProps = {
  place: AggregatePlaceAttributes
  onClickFavorite?: (
    e: React.MouseEvent<MouseEvent>,
    place: AggregatePlaceAttributes
  ) => void
  loading?: boolean
}

export default React.memo(function PlaceCard(props: PlaceCardProps) {
  const place = props.place

  const handleClickFavorite = useCallback(
    (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      if (props.onClickFavorite) {
        props.onClickFavorite(e, place)
      }
    },
    [place, props.onClickFavorite]
  )

  const href = useMemo(() => place && locations.place(place.id), [place])

  const placerUrl = placeTargetUrl(place)

  return (
    <Card
      link
      className={TokenList.join(["place-card", props.loading && "loading"])}
      href={href}
    >
      <div className="place-card__cover">
        <ImgFixed src={place?.image || ""} dimension="wide" />
      </div>
      <Card.Content>
        <Card.Header>{place?.title || " "}</Card.Header>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <JumpInPositionButton href={placerUrl} loading={props.loading} />
          <FavoriteButton
            onClick={handleClickFavorite}
            loading={props.loading}
          ></FavoriteButton>
        </div>
      </Card.Content>
    </Card>
  )
})
