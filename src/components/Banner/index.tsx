import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import DCLLogo from "../../images/dcl-logo.svg"
import GenesisBanner from "../../images/genesis-banner.png"
import WorldBanner from "../../images/worlds-banner.png"
import WorldsLogo from "../../images/worlds-logo.svg"
import { Close } from "../Icon/Close"

import "./index.css"

type BannerProps = {
  type: "places" | "worlds"
  onClose: (e: React.MouseEvent<SVGElement, MouseEvent>) => void
}

export default ({ onClose, type }: BannerProps) => {
  const l = useFormatMessage()

  return (
    <div
      className={`banner ${
        type === "places" ? "genesis-banner" : "worlds-banner"
      }`}
    >
      <div>
        <img src={type === "places" ? DCLLogo : WorldsLogo} />
        <div>
          <p className="banner__title">{l(`pages.${type}.banner.title`)}</p>
          <p className="banner__description">
            {l(`pages.${type}.banner.description`)}
          </p>
        </div>
      </div>
      <img src={type === "places" ? GenesisBanner : WorldBanner} />
      <Close width="32" height="32" type="filled" onClick={onClose} />
    </div>
  )
}
