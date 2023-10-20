import React, { Dispatch, SetStateAction, createContext, useState } from "react"

export const TrackingPlacesSearchContext = createContext<
  [string, Dispatch<SetStateAction<string>>]
>(["", function a() {} as any])

export function TrackingPlacesSearchProvider(
  props: React.PropsWithChildren<{}>
) {
  const [trackingId, setTrackingId] = useState(crypto.randomUUID() as string)

  return (
    <TrackingPlacesSearchContext.Provider value={[trackingId, setTrackingId]}>
      {props.children}
    </TrackingPlacesSearchContext.Provider>
  )
}
