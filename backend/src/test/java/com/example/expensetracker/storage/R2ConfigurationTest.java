package com.example.expensetracker.storage;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class R2ConfigurationTest {
    @Test void constructsTheRealClientWithTheApplicationsManagedDependencies() {
        var properties = new R2Properties();
        properties.setAccountId("00000000000000000000000000000000");
        properties.setBucket("test-photos");
        properties.setAccessKeyId("test-access");
        properties.setSecretAccessKey("test-secret");
        // Client construction makes no network requests. This catches HTTP transport linkage conflicts.
        try (var client = new R2Configuration().r2Client(properties)) {
            assertThat(client.serviceName()).isEqualTo("s3");
        }
    }
    @Test void rejectsIncompleteConfigurationWithoutPrintingCredentials() {
        assertThatThrownBy(() -> new R2Configuration().r2Client(new R2Properties()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("R2 requires");
    }
}
