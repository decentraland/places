import React, { useCallback } from "react"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import PlaceFavoriteButton from "../../Button/PlaceFavoriteButton"
import PlaceJumpInPositionButton from "../../Button/PlaceJumpInPositionButton"

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
  const onClickFavorite = props.onClickFavorite
  const handleJumpIn = useCallback(
    (e: React.MouseEvent<any>) => e.preventDefault(),
    []
  )

  return (
    <Card
      className={TokenList.join(["place-card", props.loading && "loading"])}
      onClick={() => console.log}
    >
      <div className="place-card__cover">
        <ImgFixed src={place?.image || ""} dimension="wide" />
      </div>
      <Card.Content>
        <Card.Header>{place?.title || " "}</Card.Header>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <PlaceJumpInPositionButton place={place} onClick={handleJumpIn} />
          <PlaceFavoriteButton
            place={place}
            onClick={onClickFavorite}
          ></PlaceFavoriteButton>
        </div>
      </Card.Content>
    </Card>
  )
})
