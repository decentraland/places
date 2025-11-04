# AI Agent Context

**Service Purpose:** Processes Catalyst scene and World deployments to maintain a searchable database of Decentraland places. Fetches entity metadata from Catalyst content servers and creates Place records for discovery, search, and navigation features.

**Key Capabilities:**

- Receives deployment notifications via AWS SQS for scenes and worlds
- Fetches entity metadata from Catalyst content servers using entity IDs
- Creates and maintains Place records in PostgreSQL database
- Provides API for querying places (scene coordinates, world names, metadata)
- Supports Gatsby frontend integration for place discovery interface

**Communication Pattern:**

- Event-driven via AWS SQS (deployment notifications)
- Synchronous HTTP API (place queries)

**Technology Stack:**

- Runtime: Node.js
- Language: TypeScript
- HTTP Framework: Express
- Database: PostgreSQL (via node-pg-migrate)
- Queue: AWS SQS (deployment event consumption)
- Component Architecture: @well-known-components (logger, http-server)

**External Dependencies:**

- Content Servers: Catalyst nodes (fetches scene/world entity metadata)
- Queue: AWS SQS (receives deployment events)
- Database: PostgreSQL (place records, scene/world metadata)

**Project Structure:**

- `src/adapters/`: Database adapters, SQS clients
- `src/logic/`: Place processing logic, entity fetching
- `bin/`: Utility scripts
