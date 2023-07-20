import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import watermelonIcon from "../../images/watermelon-icon.svg"

import "./NoResults.css"

export interface NoResultsProps {
  search: string
}

export default function NoResults(props: NoResultsProps) {
  const { search } = props
  const l = useFormatMessage()

  return (
    <>
      <p className="search-results-header">
        {l("components.search.search_results_title")} <b>"{search}"</b>
      </p>
      <div className="no-results-content">
        <p>
          <img src={watermelonIcon} />
        </p>
        <p>
          {l("components.search.no_results") + " "} "{search}"
        </p>
      </div>
    </>
  )
}
