import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { CategoryCountTargetOptions } from "../../entities/Category/types"
import DCLLogo from "../../images/dcl-logo.svg"
import GenesisBanner from "../../images/genesis-banner-mobile.png"
import WorldBanner from "../../images/worlds-banner-mobile.png"
import WorldsLogo from "../../images/worlds-logo.svg"
import { Close } from "../Icon/Close"

import "./index.css"

type BannerMobileProps = {
  type: CategoryCountTargetOptions.PLACES | CategoryCountTargetOptions.WORLDS
  onClose: (e: React.MouseEvent<SVGElement, MouseEvent>) => void
}

export default ({ type, onClose }: BannerMobileProps) => {
  const l = useFormatMessage()

  return (
    <div
      className={`banner-mobile ${
        type === CategoryCountTargetOptions.PLACES
          ? "genesis-banner-mobile"
          : "worlds-banner-mobile"
      }`}
    >
      <div>
        <img
          src={
            type === CategoryCountTargetOptions.WORLDS ? WorldsLogo : DCLLogo
          }
          alt="Decentraland Logo"
        />
        <p className="banner-mobile__title">
          {l(`pages.${type}.banner.title`)}
        </p>
        <p className="banner-mobile__description">
          {l(`pages.${type}.banner.description`)}
        </p>
      </div>
      <img
        src={
          type === CategoryCountTargetOptions.WORLDS
            ? WorldBanner
            : GenesisBanner
        }
      />
      <Close width="32" height="32" type="filled" onClick={onClose} />
    </div>
  )
}
