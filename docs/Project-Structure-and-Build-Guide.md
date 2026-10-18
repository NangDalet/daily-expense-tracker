# Daily Expense Tracker: Project Structure and Build Guide

The backend follows the domain-first Java layout shown in the School Management reference guide. It remains one Spring Boot application with one database. Each business domain owns its controllers, services, models and MyBatis interfaces. Existing API paths and Flyway migrations are preserved.

## Repository

```text
daily-expense-tracker/
|-- backend/                 Spring Boot application, Maven build and Dockerfile
|-- frontend/                Existing web application
|-- docs/                    Feature guides and this structure guide
|-- infra/                   Infrastructure configuration
|-- scripts/                 Repository utilities
|-- docker-compose.yml       Local stack
|-- docker-compose.test.yml  Test stack configuration
`-- render.yaml              Deployment configuration
```

## Spring Boot packages

Source root: `backend/src/main/java/com/example/expensetracker/`.

```text
expensetracker/
|-- ExpenseTrackerApplication.java
|-- auth/                    Login, registration, token refresh
|-- user/                    Users, profile and profile photos
|-- category/                Categories and default category seeding
|-- expense/                 Expenses, summaries and category statistics
|-- income/                  Income and income summaries
|-- budget/                  Budgets and budget usage
|-- wallet/                  Cash balances and top-ups
|-- construction/            Projects, workers, attendance and payroll
|-- telegram/                Connections, notifications and delivery workers
|-- reporting/               Monthly finance reports
|-- media/                   Authorized media retrieval
|-- common/model/            Shared roles, payment methods and API envelopes
|-- config/                  Application-wide Spring configuration
|-- security/                JWT, current user, access handlers and CORS settings
|-- storage/                 Shared photo storage and R2 configuration
|-- exception/               Shared errors and global exception handling
`-- util/                    Money and MyBatis type-handler utilities
```

Domains contain only layers they use. Typical domain layout:

```text
expense/
|-- controller/              HTTP mappings and request validation
|-- service/                 Service interface and implementation together
|-- model/                   Persistence entities and query result models
|   |-- request/             Input DTOs
|   `-- response/            Output DTOs
|-- mapper/                  MyBatis mapper interfaces
`-- convert/                 MapStruct entity/DTO conversion
```

Construction additionally owns `auth/ConstructionAccess.java` for method-security checks. Its package-private photo helper stays beside the construction service. Shared security and infrastructure remain at the application package level because multiple domains use them.

The normal request path is controller -> service -> MyBatis interface -> XML SQL -> PostgreSQL. Monthly finance reporting retains its existing controller-to-mapper query path. Domain packages group ownership; they do not enforce dependency isolation or separate database ownership. Cross-domain Java calls remain part of the existing implementation.

## Resources and scanning

```text
backend/src/main/resources/
|-- application.yml          Shared settings, mapper scanning and model aliases
|-- application-dev.yml      Local configuration
|-- application-prod.yml     Production configuration
|-- application-test.yml     Test configuration
|-- mappers/                 SQL XML, named after each domain mapper interface
`-- db/migration/            Existing versioned Flyway SQL migrations
```

`ExpenseTrackerApplication` stays above all domain packages so Spring component and configuration-property scanning includes them. Its explicit `@MapperScan` list registers only domain mapper packages, avoiding service interfaces and MapStruct converters. Add a package there when introducing a new domain with MyBatis interfaces.

`mybatis.type-aliases-package` lists domain model packages. Mapper XML namespaces and fully qualified model references match the moved Java classes; short aliases keep existing class names. SQL resources retain their existing `mappers/*.xml` locations. Do not edit an applied Flyway migration merely to update a historical package name in a comment; add migrations for schema changes.

## Tests

Unit tests mirror the relevant domain and layer under `backend/src/test/java/com/example/expensetracker/`. Shared fixtures remain in `support/`; tests spanning application features remain in `integration/`. Mapper SQL tests reside in their owning domain, while the cross-domain currency mapper test lives under `reporting/mapper/`.

## Build and run

Use Java 21 and Maven from the repository root:

```powershell
# Compile from scratch and run unit tests
mvn -f backend/pom.xml clean test

# Package and run unit plus PostgreSQL integration tests
# Docker must be available; inspect results for skipped tests.
mvn -f backend/pom.xml clean verify

# Start the backend with its configured database
mvn -f backend/pom.xml spring-boot:run

# Build and start the local stack
docker compose config --quiet
docker compose up -d --build
```

The backend uses port 8080 by default; Compose exposes it at localhost:8081 and the frontend at localhost:3000. PostgreSQL integration tests create disposable Testcontainers databases and apply the existing migrations. They do not use the normal application database. Docker image builds skip tests, so run Maven verification explicitly.

## Adding a feature

1. Choose the owning domain and put HTTP handlers in its `controller` package.
2. Keep business rules and transactions in `service`; keep interfaces and implementations together.
3. Put entities and query models in `model`, with DTOs in `model/request` and `model/response`.
4. Add MyBatis interfaces in `mapper`, SQL in `resources/mappers`, and MapStruct converters in `convert`.
5. Update mapper scanning and model aliases when adding a new domain, and add a Flyway migration when persistence changes.
6. Mirror the domain package in tests and run the relevant unit and integration checks.
