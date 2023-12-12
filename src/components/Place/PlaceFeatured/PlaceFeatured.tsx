import React, { useMemo } from "react"

import { withPrefix } from "gatsby"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Hero } from "decentraland-ui/dist/components/Hero/Hero"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { explorerUrl } from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import { getImageUrl } from "../../../utils/image"
import UserCount from "../../Label/UserCount/UserCount"

import "./PlaceFeatured.css"

export type PlaceFeaturedProps = {
  item: AggregatePlaceAttributes
  loading?: boolean
}

export default React.memo(function PlaceFeatured(props: PlaceFeaturedProps) {
  const { item, loading } = props

  const l = useFormatMessage()
  const placeJumpInUrl = item && explorerUrl(item)
  const placeDetailUrl = useMemo(() => {
    if (item.world) return locations.world(item.world_name!)
    return locations.place(item.base_position)
  }, [item])
  const handleJumpInTrack = useTrackLinkContext()

  return (
    <div
      className={TokenList.join(["place-featured", loading && "loading"])}
      style={{
        backgroundImage: `url("${getImageUrl(
          item.highlighted_image || item.image
        )}")`,
      }}
    >
      <div className="place-featured__overlay" />
      <Hero>
        <Hero.Header>
          <div className="place-featured__label-container">
            <UserCount loading={loading} value={item?.user_count || 0} />
          </div>
          {item.title}
        </Hero.Header>
        <Hero.Description>{item.description}</Hero.Description>
        <Hero.Actions>
          <Button
            primary
            as="a"
            href={withPrefix(placeJumpInUrl)}
            onClick={handleJumpInTrack}
            target="_blank"
            data-event={SegmentPlace.JumpIn}
            data-place-id={item?.id}
            data-place={SegmentPlace.highlighted}
          >
            {l("components.place_featured.jump_in")}
          </Button>

          <Button
            secondary
            as="a"
            href={withPrefix(placeDetailUrl)}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault()
              placeDetailUrl && navigate(placeDetailUrl)
            }}
          >
            {l("components.place_featured.find_out_more")}
          </Button>
        </Hero.Actions>
      </Hero>
    </div>
  )
})
