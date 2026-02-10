import React, { useContext, useMemo } from "react"

import { withPrefix } from "gatsby"

import ImgFixed from "decentraland-gatsby/dist/components/Image/ImgFixed"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Card } from "decentraland-ui/dist/components/Card/Card"

import { TrackingPlacesSearchContext } from "../../../context/TrackingContext"
import { AggregateBaseEntityAttributes } from "../../../entities/shared/types"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import UserCount from "../../Label/UserCount/UserCount"
import UserLikePercentage from "../../Label/UserLikePercentage/UserLikePercentage"
import UserPreviewCount from "../../Label/UserPreviewCount/UserPreviewCount"

import "./PlaceCard.css"

export type PlaceCardProps = {
  place?: AggregateBaseEntityAttributes
  loading?: boolean
  positionWithinList?: number
}

export default React.memo(function PlaceCard(props: PlaceCardProps) {
  const track = useTrackContext()

  const { place, loading, positionWithinList } = props

  const [trackingId] = useContext(TrackingPlacesSearchContext)

  const href = useMemo(() => {
    if (!place) return undefined
    // For worlds or world scenes, use world URL
    if (place.world && place.world_name) {
      return locations.world(place.world_name)
    }
    // For genesis places, use place URL with base_position
    return locations.place(place.base_position)
  }, [place])

  const handleClickCard = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    track(SegmentPlace.PlaceCardClick, {
      placeId: place?.id,
      trackingId: trackingId,
      positionWithinList: positionWithinList,
    })

    href && navigate(href)
  }

  return (
    <Card
      as="div"
      className={TokenList.join([
        "place-card",
        loading && "loading",
        !loading && !place && "hidden",
      ])}
    >
      <Link className="place-card__cover" href={href} onClick={handleClickCard}>
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
              value={place?.like_rate ?? null}
            />
          </div>
        </div>
      </Link>
      <Card.Content>
        <Card.Header
          as="a"
          href={href ? withPrefix(href) : href}
          onClick={handleClickCard}
        >
          {place?.title || " "}
        </Card.Header>
        <Card.Meta
          as="a"
          href={href ? withPrefix(href) : href}
          onClick={handleClickCard}
        >
          {place?.contact_name || " "}
        </Card.Meta>
      </Card.Content>
    </Card>
  )
})
