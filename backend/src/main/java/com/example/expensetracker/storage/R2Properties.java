package com.example.expensetracker.storage;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter @Setter
@ConfigurationProperties(prefix = "app.r2")
public class R2Properties {
    private boolean enabled;
    private String accountId = "";
    private String bucket = "";
    private String accessKeyId = "";
    private String secretAccessKey = "";
}
