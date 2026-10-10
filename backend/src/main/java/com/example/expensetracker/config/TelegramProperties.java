package com.example.expensetracker.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter
@ConfigurationProperties(prefix = "app.telegram")
public class TelegramProperties {
    private boolean enabled;
    private String updatesMode = "webhook";
    private String botToken = "";
    private String botUsername = "";
    private String webhookSecret = "";
    public boolean isConfigured() {
        return enabled && ("webhook".equals(updatesMode) || "polling".equals(updatesMode)) && !botToken.isBlank() && botUsername.matches("[A-Za-z0-9_]{5,32}")
                && webhookSecret.matches("[A-Za-z0-9_-]{16,256}");
    }
}
