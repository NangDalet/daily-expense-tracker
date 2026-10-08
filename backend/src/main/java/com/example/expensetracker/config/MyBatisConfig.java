package com.example.expensetracker.config;

import java.util.UUID;

import com.example.expensetracker.util.UuidTypeHandler;

import org.apache.ibatis.type.TypeHandlerRegistry;
import org.mybatis.spring.boot.autoconfigure.ConfigurationCustomizer;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis settings that cannot be expressed in {@code application.yml}.
 * <p>
 * The {@code text[]} handlers are intentionally <em>not</em> registered here:
 * {@code StringArrayTypeHandler} and {@code StringListTypeHandler} would both
 * claim {@code List} in the global registry, so they stay referenced explicitly
 * from the mapper XML. Only the {@link UUID} handler - which MyBatis does not
 * provide at all - is registered globally.
 */
@Configuration
public class MyBatisConfig {

    @Bean
    public ConfigurationCustomizer uuidTypeHandlerCustomizer() {
        return configuration -> registerUuidHandler(configuration.getTypeHandlerRegistry());
    }

    static void registerUuidHandler(TypeHandlerRegistry registry) {
        registry.register(UUID.class, UuidTypeHandler.class);
    }
}
