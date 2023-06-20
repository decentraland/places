import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import WorldsLogo from "../../../images/worlds-logo.svg"

import "./WorldLabel.css"

export default React.memo(function WorldLabel() {
  const l = useFormatMessage()

  return (
    <div className="world-label__container">
      <img src={WorldsLogo} alt="Decentraland Worlds Logo" />
      <h3>
        {l("components.world_description.decentraland")}{" "}
        <span>{l("components.world_description.worlds")}</span>
      </h3>
    </div>
  )
})
