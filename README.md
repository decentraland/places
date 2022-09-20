# Places

[![Coverage Status](https://coveralls.io/repos/github/decentraland/places/badge.svg?branch=master)](https://coveralls.io/github/decentraland/places?branch=master)

Brief description of this project.

![decentraland](https://decentraland.org/images/fallback-hero.jpg)

## Setup

### environment setup

create a copy of `.env.example` and name it as `.env.development`

```bash
  cp .env.example .env.development
```

> to know more about this file see [the documentation](https://www.gatsbyjs.com/docs/how-to/local-development/environment-variables/#defining-environment-variables)

if you are running this project locally you only need to check the following environment variables:

- `CONNECTION_STRING`: make sure it is point to a valid database

### database setup

once you have a `CONNECTION_STRING` you can setup you database tables using the following command

```bash
npm run migrate up
```

### clear database

to clear database to restart the project as is where new run the following SQL

```SQL
truncate places;
truncate place_activities;
truncate place_activity_daily;
truncate entities_places;
truncate tasks;
update deployment_tracks set "from" = 0;
```

## Run

once you setup this project you can start it using the following command

```bash
  npm start
```

> Note 1: this project run over `https`, if it is your first time you might need to run it with `sudo`

> Note 2: you can disabled `https` removing the `--https` flag in the `develop` script of your `package.json`

## Project's structure

You can find a full documentation about the project's structure in the [`decentraland-gatsby` repository](https://github.com/decentraland/decentraland-gatsby#project-structure)

### back and front ends

this project runs gatsby as front-end and a nodejs server as back-end both connected through a proxy

- locally this proxy is defined in [`gatsby-config.js` (`proxy` prop)](https://www.gatsbyjs.com/docs/api-proxy/#gatsby-skip-here)
- at servers this proxy is defined in `Pulumi.ts` (`servicePaths` prop)

### routes

**front-end** routes are defined using [gatsby routes](https://www.gatsbyjs.com/docs/reference/routing/creating-routes/#define-routes-in-srcpages) + [gatsby-plugin-intl](https://www.gatsbyjs.com/plugins/gatsby-plugin-intl/?=gatsby-plugin-intl), you can find each page in the `src/pages` directory

**back-end** routes are defined using `express` you can find each route in `src/entities/{Entity}/routes.ts` and those are imported ar `src/server.ts`
