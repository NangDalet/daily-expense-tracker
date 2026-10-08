package com.example.expensetracker.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/** CORS settings bound from {@code app.security.cors.*}. */
@ConfigurationProperties(prefix = "app.security.cors")
public class CorsProperties {

    private List<String> allowedOrigins = List.of("http://localhost:3000");

    private List<String> allowedMethods = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");

    private List<String> allowedHeaders = List.of("Authorization", "Content-Type", "Accept", "X-Requested-With");

    private List<String> exposedHeaders = List.of("Location", "X-Total-Count");

    private boolean allowCredentials = true;

    private long maxAge = 3600;

    /**
     * {@code "*"} means "reflect any origin", which the browser allows only while
     * credentials are disabled. When credentials are enabled (the normal case,
     * because the frontend sends an Authorization header) the specific origins
     * are echoed back.
     */
    public boolean isAllowAllOrigins() {
        return allowedOrigins.stream().anyMatch("*"::equals);
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> getAllowedMethods() {
        return allowedMethods;
    }

    public void setAllowedMethods(List<String> allowedMethods) {
        this.allowedMethods = allowedMethods;
    }

    public List<String> getAllowedHeaders() {
        return allowedHeaders;
    }

    public void setAllowedHeaders(List<String> allowedHeaders) {
        this.allowedHeaders = allowedHeaders;
    }

    public List<String> getExposedHeaders() {
        return exposedHeaders;
    }

    public void setExposedHeaders(List<String> exposedHeaders) {
        this.exposedHeaders = exposedHeaders;
    }

    public boolean isAllowCredentials() {
        return allowCredentials;
    }

    public void setAllowCredentials(boolean allowCredentials) {
        this.allowCredentials = allowCredentials;
    }

    public long getMaxAge() {
        return maxAge;
    }

    public void setMaxAge(long maxAge) {
        this.maxAge = maxAge;
    }

    public boolean hasOrigin(String origin) {
        return StringUtils.hasText(origin) && (isAllowAllOrigins() || allowedOrigins.contains(origin));
    }
}
