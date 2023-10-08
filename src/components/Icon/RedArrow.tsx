import React from "react"

export type RedArrowProps = React.SVGAttributes<SVGElement>

export const RedArrow = React.memo((props: RedArrowProps) => (
  <svg {...props} viewBox="0 0 15 26" fill="none">
    <g id="RedArrow">
      <path
        id="Vector"
        d="M5.05882 18.3361L4.16718 17.4617C3.94427 17.2432 3.94427 16.8934 4.16718 16.6749L8.02353 12.8934C8.24644 12.6749 8.24644 12.3251 8.02353 12.1066L4.18947 8.32514C3.96656 8.10656 3.96656 7.75683 4.18947 7.53825L5.08111 6.66393C5.30402 6.44536 5.66068 6.44536 5.88359 6.66393L11.4341 12.1066C11.657 12.3251 11.657 12.6749 11.4341 12.8934L5.88359 18.3361C5.66068 18.5546 5.30402 18.5546 5.05882 18.3361Z"
        fill="#FF2D55"
      />
    </g>
  </svg>
))
