import React, { useMemo } from "react"

import { withPrefix } from "gatsby"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import locations from "../../../modules/locations"

import "./AdminPlaceCard.css"

export type AdminPlaceCardProps = {
  place: AggregatePlaceAttributes
  loading?: boolean
  onToggleHighlight: (highlighted: boolean) => void
}

export default React.memo(function AdminPlaceCard(props: AdminPlaceCardProps) {
  const { place, loading, onToggleHighlight } = props
  const l = useFormatMessage()

  const href = useMemo(() => {
    if (place && !place.world) {
      return locations.place(place.base_position)
    } else if (place && place.world) {
      return locations.world(place.world_name!)
    }
    return ""
  }, [place])

  const handleToggleHighlight = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleHighlight(!place.highlighted)
  }

  return (
    <Card
      className={TokenList.join([
        "admin-place-card",
        place.highlighted && "admin-place-card--highlighted",
      ])}
    >
      <Link className="admin-place-card__cover" href={href}>
        <ImgFixed src={place.image || ""} dimension="wide" />
        {place.highlighted && (
          <div className="admin-place-card__badge">
            {l("components.admin_place_card.highlighted")}
          </div>
        )}
        {place.world && (
          <div className="admin-place-card__world-badge">
            {l("components.admin_place_card.world")}
          </div>
        )}
      </Link>
      <Card.Content>
        <Card.Header as="a" href={href ? withPrefix(href) : href}>
          {place.title || " "}
        </Card.Header>
        <Card.Meta>
          {place.world ? place.world_name : place.base_position}
        </Card.Meta>
        <Card.Description className="admin-place-card__info">
          <span>
            {l("components.admin_place_card.favorites")}: {place.favorites}
          </span>
          <span>
            {l("components.admin_place_card.likes")}: {place.likes}
          </span>
        </Card.Description>
      </Card.Content>
      <Card.Content extra>
        <div className="admin-place-card__actions">
          {place.highlighted ? (
            <Button
              basic
              color="red"
              size="small"
              loading={loading}
              disabled={loading}
              onClick={handleToggleHighlight}
            >
              {l("components.admin_place_card.remove_highlight")}
            </Button>
          ) : (
            <Button
              primary
              size="small"
              loading={loading}
              disabled={loading}
              onClick={handleToggleHighlight}
            >
              {l("components.admin_place_card.add_highlight")}
            </Button>
          )}
        </div>
      </Card.Content>
    </Card>
  )
})
