import { EntityType } from "@dcl/schemas/dist/platform/entity"
import { ProfileMetadata } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

export const userLikeTrue = {
  user: "0x8Cff6832174091DAe86F0244e3Fd92d4CeD2Fe07",
  place_id: "67b4c5c3-6b2c-4521-9253-cc3a3f8ce138",
  like: true,
  user_activity: 0,
  created_at: new Date(),
  updated_at: new Date(),
}

export const userLikeFalse = {
  ...userLikeTrue,
  like: false,
}

export const genesisPlazaThumbnailMap =
  "https://api.decentraland.org/v2/map.png?height=1024&width=1024&selected=-1%2C-1%3B-1%2C-2%3B-1%2C-3%3B-1%2C-4%3B-1%2C-5%3B-1%2C-6%3B-1%2C-7%3B-1%2C-8%3B-1%2C-9%3B-1%2C0%3B-1%2C1%3B-1%2C2%3B-1%2C3%3B-1%2C4%3B-1%2C5%3B-1%2C6%3B-1%2C7%3B-1%2C8%3B-1%2C9%3B-2%2C-1%3B-2%2C-2%3B-2%2C-3%3B-2%2C-4%3B-2%2C-5%3B-2%2C-6%3B-2%2C-7%3B-2%2C-8%3B-2%2C-9%3B-2%2C0%3B-2%2C1%3B-2%2C2%3B-2%2C3%3B-2%2C4%3B-2%2C5%3B-2%2C6%3B-2%2C7%3B-2%2C8%3B-2%2C9%3B-3%2C-1%3B-3%2C-2%3B-3%2C-3%3B-3%2C-4%3B-3%2C-5%3B-3%2C-6%3B-3%2C-7%3B-3%2C-8%3B-3%2C-9%3B-3%2C0%3B-3%2C1%3B-3%2C2%3B-3%2C3%3B-3%2C4%3B-3%2C5%3B-3%2C6%3B-3%2C7%3B-3%2C8%3B-3%2C9%3B-4%2C-1%3B-4%2C-2%3B-4%2C-3%3B-4%2C-4%3B-4%2C-5%3B-4%2C-6%3B-4%2C-7%3B-4%2C-8%3B-4%2C-9%3B-4%2C0%3B-4%2C1%3B-4%2C2%3B-4%2C3%3B-4%2C4%3B-4%2C5%3B-4%2C6%3B-4%2C7%3B-4%2C8%3B-4%2C9%3B-5%2C-1%3B-5%2C-2%3B-5%2C-3%3B-5%2C-4%3B-5%2C-5%3B-5%2C-6%3B-5%2C-7%3B-5%2C-8%3B-5%2C-9%3B-5%2C0%3B-5%2C1%3B-5%2C2%3B-5%2C3%3B-5%2C4%3B-5%2C5%3B-5%2C6%3B-5%2C7%3B-5%2C8%3B-5%2C9%3B-6%2C-1%3B-6%2C-2%3B-6%2C-3%3B-6%2C-4%3B-6%2C-5%3B-6%2C-6%3B-6%2C-7%3B-6%2C-8%3B-6%2C-9%3B-6%2C0%3B-6%2C1%3B-6%2C2%3B-6%2C3%3B-6%2C4%3B-6%2C5%3B-6%2C6%3B-6%2C7%3B-6%2C8%3B-6%2C9%3B-7%2C-1%3B-7%2C-2%3B-7%2C-3%3B-7%2C-4%3B-7%2C-5%3B-7%2C-6%3B-7%2C-7%3B-7%2C-8%3B-7%2C-9%3B-7%2C0%3B-7%2C1%3B-7%2C2%3B-7%2C3%3B-7%2C4%3B-7%2C5%3B-7%2C6%3B-7%2C7%3B-7%2C8%3B-7%2C9%3B-8%2C-1%3B-8%2C-2%3B-8%2C-3%3B-8%2C-4%3B-8%2C-5%3B-8%2C-6%3B-8%2C-7%3B-8%2C-8%3B-8%2C-9%3B-8%2C0%3B-8%2C1%3B-8%2C2%3B-8%2C3%3B-8%2C4%3B-8%2C5%3B-8%2C6%3B-8%2C7%3B-8%2C8%3B-8%2C9%3B-9%2C-1%3B-9%2C-2%3B-9%2C-3%3B-9%2C-4%3B-9%2C-5%3B-9%2C-6%3B-9%2C-7%3B-9%2C-8%3B-9%2C-9%3B-9%2C0%3B-9%2C1%3B-9%2C2%3B-9%2C3%3B-9%2C4%3B-9%2C5%3B-9%2C6%3B-9%2C7%3B-9%2C8%3B-9%2C9%3B0%2C-1%3B0%2C-2%3B0%2C-3%3B0%2C-4%3B0%2C-5%3B0%2C-6%3B0%2C-7%3B0%2C-8%3B0%2C-9%3B0%2C0%3B0%2C1%3B0%2C2%3B0%2C3%3B0%2C4%3B0%2C5%3B0%2C6%3B0%2C7%3B0%2C8%3B0%2C9%3B1%2C-1%3B1%2C-2%3B1%2C-3%3B1%2C-4%3B1%2C-5%3B1%2C-6%3B1%2C-7%3B1%2C-8%3B1%2C-9%3B1%2C0%3B1%2C1%3B1%2C2%3B1%2C3%3B1%2C4%3B1%2C5%3B1%2C6%3B1%2C7%3B1%2C8%3B1%2C9%3B10%2C-1%3B10%2C-2%3B10%2C-3%3B10%2C-4%3B10%2C-5%3B10%2C-6%3B10%2C-7%3B10%2C-8%3B10%2C-9%3B10%2C0%3B10%2C1%3B10%2C2%3B10%2C3%3B10%2C4%3B10%2C5%3B10%2C6%3B10%2C7%3B10%2C8%3B10%2C9%3B2%2C-1%3B2%2C-2%3B2%2C-3%3B2%2C-4%3B2%2C-5%3B2%2C-6%3B2%2C-7%3B2%2C-8%3B2%2C-9%3B2%2C0%3B2%2C1%3B2%2C2%3B2%2C3%3B2%2C4%3B2%2C5%3B2%2C6%3B2%2C7%3B2%2C8%3B2%2C9%3B3%2C-1%3B3%2C-2%3B3%2C-3%3B3%2C-4%3B3%2C-5%3B3%2C-6%3B3%2C-7%3B3%2C-8%3B3%2C-9%3B3%2C0%3B3%2C1%3B3%2C2%3B3%2C3%3B3%2C4%3B3%2C5%3B3%2C6%3B3%2C7%3B3%2C8%3B3%2C9%3B4%2C-1%3B4%2C-2%3B4%2C-3%3B4%2C-4%3B4%2C-5%3B4%2C-6%3B4%2C-7%3B4%2C-8%3B4%2C-9%3B4%2C0%3B4%2C1%3B4%2C2%3B4%2C3%3B4%2C4%3B4%2C5%3B4%2C6%3B4%2C7%3B4%2C8%3B4%2C9%3B5%2C-1%3B5%2C-2%3B5%2C-3%3B5%2C-4%3B5%2C-5%3B5%2C-6%3B5%2C-7%3B5%2C-8%3B5%2C-9%3B5%2C0%3B5%2C1%3B5%2C2%3B5%2C3%3B5%2C4%3B5%2C5%3B5%2C6%3B5%2C7%3B5%2C8%3B5%2C9%3B6%2C-1%3B6%2C-2%3B6%2C-3%3B6%2C-4%3B6%2C-5%3B6%2C-6%3B6%2C-7%3B6%2C-8%3B6%2C-9%3B6%2C0%3B6%2C1%3B6%2C2%3B6%2C3%3B6%2C4%3B6%2C5%3B6%2C6%3B6%2C7%3B6%2C8%3B6%2C9%3B7%2C-1%3B7%2C-2%3B7%2C-3%3B7%2C-4%3B7%2C-5%3B7%2C-6%3B7%2C-7%3B7%2C-8%3B7%2C-9%3B7%2C0%3B7%2C1%3B7%2C2%3B7%2C3%3B7%2C4%3B7%2C5%3B7%2C6%3B7%2C7%3B7%2C8%3B7%2C9%3B8%2C-1%3B8%2C-2%3B8%2C-3%3B8%2C-4%3B8%2C-5%3B8%2C-6%3B8%2C-7%3B8%2C-8%3B8%2C-9%3B8%2C0%3B8%2C1%3B8%2C2%3B8%2C3%3B8%2C4%3B8%2C5%3B8%2C6%3B8%2C7%3B8%2C8%3B8%2C9%3B9%2C-1%3B9%2C-2%3B9%2C-3%3B9%2C-4%3B9%2C-5%3B9%2C-6%3B9%2C-7%3B9%2C-8%3B9%2C-9%3B9%2C0%3B9%2C1%3B9%2C2%3B9%2C3%3B9%2C4%3B9%2C5%3B9%2C6%3B9%2C7%3B9%2C8%3B9%2C9&center=0%2C0&size=20"

export type ContentEntityProfile = {
  version: string
  type: EntityType.PROFILE
  pointers: string[]
  timestamp: number
  content: {
    file: string
    hash: string
  }[]
  metadata: ProfileMetadata
}

export const exampleContentEntityProfile: ContentEntityProfile = {
  version: "v3",
  type: EntityType.PROFILE,
  pointers: ["0x8cff6832174091dae86f0244e3fd92d4ced2fe07"],
  timestamp: 1677502385880,
  content: [
    {
      file: "body.png",
      hash: "bafkreie3rnpnmhlwv3yav2bmritdhq4ia6ohvy2dqk5ng6c6furp5ppkby",
    },
    {
      file: "face256.png",
      hash: "bafkreifrylynxtr62mvucnecq5owifqwkczr5uipacj7dcac4kx4ogpery",
    },
  ],
  metadata: {
    avatars: [
      {
        hasClaimedName: true,
        name: "frami",
        description: "",
        tutorialStep: 4095,
        userId: "0x8cff6832174091dae86f0244e3fd92d4ced2fe07",
        email: "",
        version: 3,
        ethAddress: "0x8cff6832174091dae86f0244e3fd92d4ced2fe07",
        avatar: {
          bodyShape: "urn:decentraland:off-chain:base-avatars:BaseMale",
          wearables: [
            "urn:decentraland:off-chain:base-avatars:eyes_00",
            "urn:decentraland:off-chain:base-avatars:eyebrows_00",
            "urn:decentraland:off-chain:base-avatars:mouth_07",
            "urn:decentraland:matic:collections-v2:0xcf7f769ea20797f2da34962c72b891e391da8a73:0",
            "urn:decentraland:matic:collections-v2:0xee77b0a104cd6db1bbbcfa2f13076f234647c017:2",
            "urn:decentraland:ethereum:collections-v1:halloween_2019:machete_headband_top_head",
            "urn:decentraland:matic:collections-v2:0xee77b0a104cd6db1bbbcfa2f13076f234647c017:1",
            "urn:decentraland:ethereum:collections-v1:xmash_up_2020:xmash_up_coat_upper_body",
          ],
          snapshots: {
            body: "bafkreie3rnpnmhlwv3yav2bmritdhq4ia6ohvy2dqk5ng6c6furp5ppkby",
            face: "bafkreifrylynxtr62mvucnecq5owifqwkczr5uipacj7dcac4kx4ogpery",
            face128:
              "bafkreifrylynxtr62mvucnecq5owifqwkczr5uipacj7dcac4kx4ogpery",
            face256:
              "bafkreifrylynxtr62mvucnecq5owifqwkczr5uipacj7dcac4kx4ogpery",
          },
          eyes: {
            color: {
              r: 0.37254902720451355,
              g: 0.2235294133424759,
              b: 0.19607843458652496,
              a: 1,
            },
          },
          hair: {
            color: {
              r: 0.48235294222831726,
              g: 0.2823529541492462,
              b: 0.09411764144897461,
              a: 1,
            },
          },
          skin: {
            color: {
              r: 0.9490196108818054,
              g: 0.7607843279838562,
              b: 0.6470588445663452,
              a: 1,
            },
          },
          version: 1,
        },
        inventory: [""],
        blocked: [""],
      },
    ],
  },
}
