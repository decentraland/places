import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import DCLLogo from "../../images/dcl-logo.svg"
import GenesisBanner from "../../images/genesis-banner-mobile.png"
import WorldBanner from "../../images/worlds-banner.png"
import WorldsLogo from "../../images/worlds-logo.svg"
import { Close } from "../Icon/Close"

import "./index.css"

type BannerMobileProps = {
  type: "places" | "worlds"
  onClose: (e: React.MouseEvent<SVGElement, MouseEvent>) => void
}

export default ({ type, onClose }: BannerMobileProps) => {
  const l = useFormatMessage()

  return (
    <div
      className={`banner-mobile ${
        type === "places" ? "genesis-banner-mobile" : "worlds-banner-mobile"
      }`}
    >
      <div>
        <img
          src={type === "worlds" ? WorldsLogo : DCLLogo}
          alt="Decentraland Logo"
        />
        <p className="banner-mobile__title">
          {l(`pages.${type}.banner.title`)}
        </p>
        <p className="banner-mobile__description">
          {l(`pages.${type}.banner.description`)}
        </p>
      </div>
      <img src={type === "worlds" ? WorldBanner : GenesisBanner} />
      <Close width="32" height="32" type="filled" onClick={onClose} />
    </div>
  )
}
