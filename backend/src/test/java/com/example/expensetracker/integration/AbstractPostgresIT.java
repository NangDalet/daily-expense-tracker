package com.example.expensetracker.integration;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Boots a throw-away PostgreSQL 16 instance with the Flyway migrations applied,
 * so the integration tests exercise the real XML mappers against the real schema.
 * <p>
 * The container lifecycle is driven by hand instead of through
 * {@code @Testcontainers(disabledWithoutDocker = true)}: that flag relies on
 * {@code DockerClientFactory#isDockerAvailable()}, which reports "unavailable"
 * even on a working daemon (Testcontainers 1.20.3), so it silently skipped every
 * test. Here the daemon is pinged directly and, when it is genuinely absent,
 * {@link Assumptions} skips the class instead of failing the build - which keeps
 * {@code mvn verify} usable on machines that only want the unit tests.
 */
public abstract class AbstractPostgresIT {

    private static final String IMAGE = "postgres:16-alpine";

    private static PostgreSQLContainer<?> database;

    @BeforeAll
    static void startDatabase() {
        Assumptions.assumeTrue(dockerAvailable(),
                "Docker daemon is not reachable - skipping the PostgreSQL integration tests");

        database = new PostgreSQLContainer<>(IMAGE)
                .withDatabaseName("expense_tracker_test")
                .withUsername("postgres")
                .withPassword("postgres");
        database.start();
    }

    @AfterAll
    static void stopDatabase() {
        if (database != null) {
            database.stop();
            database = null;
        }
    }

    /**
     * Evaluated by Spring while it creates the application context, which happens
     * after {@link #startDatabase()} because {@code @BeforeAll} methods are
     * invoked before the first test instance is created.
     */
    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> database.getJdbcUrl());
        registry.add("spring.datasource.username", () -> database.getUsername());
        registry.add("spring.datasource.password", () -> database.getPassword());
    }

    private static boolean dockerAvailable() {
        try {
            DockerClientFactory.instance().client().pingCmd().exec();
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
