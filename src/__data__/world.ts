import { EntityType } from "@dcl/schemas/dist/platform/entity"
import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { WorldAbout } from "../entities/CheckScenes/types"
import { PlaceAttributes } from "../entities/Place/types"

export const worldPlaceParalax: PlaceAttributes = {
  id: "67b4c5c3-6b2c-4521-9253-cc3a3f8ce138",
  title: "#003ZR-Spring Villa",
  description: null,
  image:
    "https://api.decentraland.org/v2/map.png?height=1024&width=1024&selected=0%2C0&center=0%2C0&size=20",
  owner: null,
  tags: [],
  positions: ["0,0"],
  base_position: "0,0",
  contact_name: "paralax",
  contact_email: null,
  content_rating: null,
  disabled: false,
  disabled_at: null,
  created_at: new Date("2023-03-28T13:05:45.437Z"),
  updated_at: new Date("2023-03-28T13:05:45.437Z"),
  favorites: 0,
  likes: 0,
  dislikes: 0,
  categories: [],
  like_rate: 0.5,
  highlighted: false,
  highlighted_image: null,
  featured: false,
  featured_image: null,
  world: true,
  world_name: "paralax.dcl.eth",
  deployed_at: new Date("2023-03-28T13:05:45.437Z"),
}

export const worldContentEntitySceneParalax: ContentEntityScene = {
  version: "v3",
  type: EntityType.SCENE,
  pointers: ["0,0"],
  timestamp: 1678735679000,
  content: [
    {
      file: "0027479d-2059-451c-a7a7-9dfe68ece51f/Spring villa.glb",
      hash: "bafybeigynnudjixdnk6raiqhfzkbvnyu3vg2ktmhqb5metagc7afazajz4",
    },
    {
      file: "bin/game.js",
      hash: "bafkreidxb345bwbdtiuyghqn5dizgxcavwnvgcyw5rzegfn2gp2rgv334e",
    },
    {
      file: "bin/game.js.lib",
      hash: "bafkreibjj6pqrepdld55rwrmb626avkygtosy2zsox6v7khvhaznm7lcfe",
    },
    {
      file: "builder.json",
      hash: "bafkreigtaxfryjbolsszupc3x256r5edslnp4qpptkwbxko5dqheux3gxm",
    },
    {
      file: "c9b17021-765c-4d9a-9966-ce93a9c323d1/FloorBaseGrass_01/FloorBaseGrass_01.glb",
      hash: "bafkreibytthve4zjlvbcnadjec2wjex2etqxuqtluriefzwwl4qe2qynne",
    },
    {
      file: "c9b17021-765c-4d9a-9966-ce93a9c323d1/FloorBaseGrass_01/Floor_Grass01.png.png",
      hash: "bafkreid2fuffvxm6w2uimphn4tyxyox3eewt3r67zbrewbdonkjb7bqzx4",
    },
    {
      file: "c9b17021-765c-4d9a-9966-ce93a9c323d1/FloorBaseGrass_01/thumbnail.png",
      hash: "bafkreiettvk4675jx7oi7pofbggn5kbgu6s6gqztiw4bcxhbik4actedge",
    },
    {
      file: "scene-thumbnail.png",
      hash: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    },
    {
      file: "scene.json",
      hash: "bafkreihrwcmumhfsqzalxdjyynvz5cd53kwxeejtg66tvcxnneys3ksf4y",
    },
  ],
  metadata: {
    display: {
      title: "#003ZR-Spring Villa",
      favicon: "favicon_asset",
      navmapThumbnail: "scene-thumbnail.png",
    },
    owner: "",
    contact: {
      name: "paralax",
      email: "",
    },
    main: "bin/game.js",
    tags: [],
    scene: {
      parcels: ["0,0"],
      base: "0,0",
    },
    source: {
      version: 1,
      origin: "builder",
      projectId: "3c84241f-6405-4ccd-92f9-88df8afa79fa",
      point: {
        x: 0,
        y: 0,
      },
      rotation: "east",
      layout: {
        rows: 1,
        cols: 1,
      },
    },
    worldConfiguration: {
      name: "paralax.dcl.eth",
    },
  },
}

export const worldAboutParalax: WorldAbout = {
  healthy: true,
  acceptingUsers: true,
  configurations: {
    networkId: 1,
    globalScenesUrn: [],
    scenesUrn: [
      "urn:decentraland:entity:bafkreigmbmwtfptb7uocny5fpnnxl2vvbzxxzbdkzpmneqgbjw2if62f2e?baseUrl=https://worlds-content-server.decentraland.org/contents/",
    ],
    minimap: {
      enabled: false,
    },
    skybox: {},
    realmName: "paralax.dcl.eth",
  },
  content: {
    healthy: true,
    publicUrl: "https://peer.decentraland.org/content",
  },
  lambdas: {
    healthy: true,
    publicUrl: "https://peer.decentraland.org/lambdas",
  },
  comms: {
    healthy: true,
    protocol: "v3",
    fixedAdapter:
      "signed-login:https://worlds-content-server.decentraland.org/get-comms-adapter/world-prd-paralax.dcl.eth",
  },
}
