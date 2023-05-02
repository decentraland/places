import { useEffect, useState } from "react"

export function useCardsByWidth(options: {
  cardWidth: number
  cardMargin: number
  containerMargin: number
}) {
  const { cardWidth, cardMargin, containerMargin } = options
  const [cardColumns, setCardColumns] = useState(1)

  useEffect(() => {
    const updateSize = () => {
      setCardColumns(
        Math.max(
          1,
          Math.floor(
            (window.innerWidth - containerMargin * 2 - cardMargin) /
              (cardWidth + cardMargin)
          )
        )
      )
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  return cardColumns
}
