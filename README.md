# Azure Cosmos DB UI Manager (CosmosUI)

<img width="2880" height="1614" alt="Cosmos UI Manager Banner" src="https://github.com/user-attachments/assets/aa203759-f199-4ee5-8dee-54b9f41acbe2" />

A lightweight, enterprise-grade web management portal and data explorer for **Azure Cosmos DB (SQL/NoSQL API)**. Designed specifically for secure private VNet topologies (AKS / ACA), high-throughput streaming workloads (20L+ records), and strict Role-Based Access Control (RBAC).

---

## 🚀 Key Features & Capabilities

### 1. Enterprise Authentication & Setup Lifecycle
- **Day 0 Initial Setup**: When connecting to a fresh Cosmos DB instance without existing users, the portal automatically triggers the **Master Admin Setup** wizard to initialize the system database and create the primary administrator.
- **Day 1 User Authentication**: Standard sign-in screen with username/password authentication and backend Cosmos DB credential management.
- **Non-Decryptable Password Security**: Passwords are mathematically irreversible, hashed using salted `scrypt` (`werkzeug.security`). Plaintext passwords are never stored or logged anywhere.
- **Enforced Password Resets**: Admins can flag accounts for required password change on next login.

### 2. Role-Based Access Control (RBAC)
- 👑 **Administrator (`admin`)**: Full access to all business databases, containers, and documents + full access to **Portal Management** (User creation/editing, bulk CSV import, password resets, and Activity Audit Logs).
- ✍️ **Contributor (`contributor`)**: Full read/write access to business databases and containers (Create, Edit, Delete, Bulk Delete, Empty Container, High-Speed Import, High-Speed Export). Restricted from user management and system settings.
- 👁️ **Reader (`reader`)**: View-only access. Can browse databases, view containers, execute Cosmos SQL queries, and export datasets. All mutation controls (Create, Edit, Delete, Empty, Import, Provision) are hidden and server-side protected.

### 3. Hidden System Storage Architecture
- System configuration, user credentials, and activity audit logs are stored natively inside Cosmos DB in dedicated internal containers:
  - System Database: `cosmos-access`
  - User Store: `cosmosusers` (PK: `/id`)
  - Audit Trail Store: `cosmosactivitylogs` (PK: `/id`)
- **Zero UI Pollution**: The system database and containers are automatically hidden from all sidebar navigation trees, database selectors, and data explorers.

### 4. High-Throughput Ingestion & Streaming Export (20L+ Records)
- **High-Speed Bulk Ingestion**: Stream and ingest 400k+ records from JSON, JSONL/NDJSON, CSV, or Excel with tunable worker concurrency (up to 200 workers) and automatic HTTP 429 rate limit backoff.
- **Streaming Export**: Non-blocking streaming export supporting `.jsonl`, `.json`, `.csv`, and `.xlsx` formats directly from disk, preventing memory exhaustion and Azure Application Gateway 30-second timeouts.
- **Live Progress & Throughput Metrics**: Real-time progress bars, processed document counters, speed indicators (docs/sec), and 429 retry meters.

### 5. Cosmos SQL Console & Multi-Select Operations
- **Full SQL Support**: Execute complex SQL queries with custom projections (`SELECT c.id, c.status`), `ORDER BY`, `TOP`, and aggregate expressions.
- **Multi-Select Bulk Deletion**: Batch delete selected documents with automatic partition key routing and 429 retry backoff.
- **Empty Container Purge**: Instant one-click container wipe while preserving partition key paths, throughput (RU/s), and indexing policies.

### 6. Activity Audit Logging
- Complete chronological audit log of all database mutations, container provisioning, document edits/deletions, bulk operations, user logins, and administrative actions.
- Multi-criteria filtering (by service, username, date range, status) with one-click **CSV** and **JSON** export.

---

## 🛠️ Configuration & Environment Variables

You can customize the system database, containers, and partition keys using environment variables. If not specified, the application seamlessly defaults to standard secure names:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `COSMOS_AUTH_DB` / `SYSTEM_DB` | `cosmos-access` | Database name for auth & audit storage |
| `COSMOS_USER_CONTAINER` / `USER_CONTAINER` | `cosmosusers` | Container name for portal user accounts |
| `COSMOS_USER_PK_PATH` | `/id` | Partition key path for user accounts |
| `COSMOS_LOGS_CONTAINER` / `LOGS_CONTAINER` | `cosmosactivitylogs` | Container name for activity audit logs |
| `COSMOS_LOGS_PK_PATH` | `/id` | Partition key path for activity audit logs |
| `SECRET_KEY` | *(Auto-generated)* | Flask session signing secret key |
| `PORT` | `8000` | Application listening port |

---

## 👥 User Management & Bulk Import Format

Administrators can import batches of users via CSV or Excel (`.xlsx`). The file must include the following headers:

```csv
username,email,password,enforcepasswordreset,role,display_name
jdoe,john.doe@example.com,TempPass123!,1,contributor,John Doe
asmith,alice.smith@example.com,TempPass456!,0,reader,Alice Smith
admin2,admin2@example.com,SecretAdmin789!,1,admin,Backup Administrator
```

- `enforcepasswordreset`: Set to `1` or `true` to require password change on initial login.
- `role`: One of `admin`, `contributor`, or `reader` (defaults to `contributor`).

---

## 🐳 Docker Deployment

This project utilizes an optimized multi-stage build on `python:3.12-alpine` for an ultra-compact image footprint.

### 1. Run Locally with Docker
```bash
docker run -d \
  -p 8000:8000 \
  -e COSMOS_AUTH_DB=cosmos-access \
  -e COSMOS_USER_CONTAINER=cosmosusers \
  -e COSMOS_LOGS_CONTAINER=cosmosactivitylogs \
  --name cosmos-ui \
  dockercustom/cosmos-ui:latest
```
Access the application at `http://localhost:8000`.

### 2. Deploy to Azure Kubernetes Service (AKS) / Azure Container Apps (ACA)
Deploying within your private Virtual Network (VNet) allows seamless access to private Cosmos DB endpoints without exposing connection strings or accounts to the public internet:

1. **Pull Image**: Use `dockercustom/cosmos-ui:latest` (or push to your private Azure Container Registry).
2. **Configure Service & Ingress**: Map container port `8000` to your internal ingress controller with path `/cosmos-ui`.
3. **Network Rules**: Ensure the subnet has VNet peering, private DNS zone resolution, or Private Endpoints enabled for Cosmos DB.

---

## 🔒 Security Best Practices
- **One-Way Salted Hashes**: All passwords stored in `cosmosusers` use cryptographic `scrypt` hashing.
- **Session Isolation**: Server-side sessions with secure cookies and expiration.
- **System Isolation**: Business data queries and operations are strictly separated from authentication databases.
- **Gateway Safe**: Long-running background import and export streaming prevents 30s timeout drops through Azure Application Gateway.

