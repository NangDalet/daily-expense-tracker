package com.example.expensetracker.config;

import java.util.List;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 description served at {@code /v3/api-docs} and rendered by
 * Swagger UI at {@code /swagger-ui.html}.
 * <p>
 * Declaring the {@code bearerAuth} scheme means the UI shows an "Authorize"
 * button, so a token obtained from {@code POST /api/v1/auth/login} can be
 * pasted in and used against every protected endpoint.
 */
@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI expenseTrackerOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Daily Expense Tracker API")
                        .version("1.0.0")
                        .description("""
                                REST API for tracking daily expenses: expenses, categories, budgets and users.

                                ### Authentication
                                1. `POST /api/v1/auth/login` with `{"username":"demo","password":"Demo@123"}`
                                2. Copy the returned `accessToken`
                                3. Click **Authorize** above and paste the token

                                Tokens are validated as OAuth2 JWTs. When `OAUTH_ISSUER_URI` is configured the
                                application accepts tokens issued by that provider, otherwise it issues and
                                validates its own.
                                """)
                        .contact(new Contact().name("Expense Tracker Team").email("api@expense-tracker.local"))
                        .license(new License().name("MIT")))
                .servers(List.of(new Server().url("/").description("Current host")))
                .components(new Components().addSecuritySchemes(SECURITY_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT access token issued by /api/v1/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME));
    }
}
