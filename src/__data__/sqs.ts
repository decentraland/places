import { AuthLinkType } from "@dcl/schemas/dist/misc/auth-chain"

import { DeploymentToSqs } from "../entities/CheckScenes/task/consumer"

export const sqsMessage: DeploymentToSqs = {
  entity: {
    entityId: "bafkreidw4inuymukjj4otmld76a5qo4sowc6lbqqk6h4dtci4yxv5qkjie",
    authChain: [
      {
        signature: "",
        type: AuthLinkType.SIGNER,
        payload: "payload",
      },
    ],
  },
  contentServerUrls: ["https://peer.decentraland.org/content"],
}

export const sqsMessageRoad: DeploymentToSqs = {
  entity: {
    entityId: "QmY3s3UCiwyhmLdRv7H1592DuWeNhj578J4VHrUrfywD92",
    authChain: [
      {
        signature: "",
        type: AuthLinkType.SIGNER,
        payload: "payload",
      },
    ],
  },
  contentServerUrls: ["https://peer.decentraland.org/content"],
}

export const sqsMessageProfile: DeploymentToSqs = {
  entity: {
    entityId: "bafkreifda4yoyikpngjyxnkq6qa2ovon23n6mor2cb4cpgb2ax3v2jv6ky",
    authChain: [
      {
        signature: "",
        type: AuthLinkType.SIGNER,
        payload: "payload",
      },
    ],
  },
  contentServerUrls: ["https://peer.decentraland.org/content"],
}

export const sqsMessageWithWrongEntityId: DeploymentToSqs = {
  entity: {
    entityId: "XXX",
    authChain: [
      {
        signature: "",
        type: AuthLinkType.SIGNER,
        payload: "payload",
      },
    ],
  },
  contentServerUrls: ["https://peer.decentraland.org/content"],
}

export const sqsMessageWorld: DeploymentToSqs = {
  entity: {
    entityId: "bafkreigmbmwtfptb7uocny5fpnnxl2vvbzxxzbdkzpmneqgbjw2if62f2e",
    authChain: [
      {
        signature: "",
        type: AuthLinkType.SIGNER,
        payload: "payload",
      },
    ],
  },
  contentServerUrls: ["https://worlds-content-server.decentraland.org"],
}
