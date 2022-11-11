import React, { useMemo } from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Hero } from "decentraland-ui/dist/components/Hero/Hero"
import {
  useMobileMediaQuery,
  useTabletAndBelowMediaQuery,
} from "decentraland-ui/dist/components/Media/Media"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { placeTargetUrl } from "../../../entities/Place/utils"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"

import "./PlaceFeatured.css"

export type PlaceFeaturedProps = {
  item: AggregatePlaceAttributes
  loading?: boolean
}

export default React.memo(function PlaceFeatured(props: PlaceFeaturedProps) {
  const { item, loading } = props

  const l = useFormatMessage()
  const placeJumpInUrl = item && placeTargetUrl(item)
  const placeDetailUrl = useMemo(() => item && locations.place(item.id), [item])
  const handleJumpInTrack = useTrackLinkContext()
  const isMobile = useMobileMediaQuery()
  const isTabletOrMobile = useTabletAndBelowMediaQuery()

  return (
    <div
      className={TokenList.join(["place-featured", loading && "loading"])}
      style={{
        backgroundImage: `url("${item.highlighted_image || item.image}")`,
      }}
    >
      <Hero centered={isMobile}>
        <Hero.Header>{item.title}</Hero.Header>
        <Hero.Description>{item.description}</Hero.Description>
        <Hero.Actions>
          {!isTabletOrMobile && (
            <Button
              primary
              as="a"
              href={placeJumpInUrl}
              onClick={handleJumpInTrack}
              target="_blank"
              data-event={SegmentPlace.JumpIn}
              data-place-id={item?.id}
              data-place={SegmentPlace.highlighted}
            >
              {l("components.place_featured.jump_in")}
            </Button>
          )}

          <Button
            secondary
            as="a"
            href={placeDetailUrl}
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
