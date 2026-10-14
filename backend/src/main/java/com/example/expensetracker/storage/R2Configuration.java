package com.example.expensetracker.storage;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
@ConditionalOnProperty(name = "app.r2.enabled", havingValue = "true")
public class R2Configuration {
    @Bean(destroyMethod = "close")
    public S3Client r2Client(R2Properties properties) {
        if (!properties.getAccountId().matches("[a-fA-F0-9]{32}") || properties.getBucket().isBlank()
                || properties.getAccessKeyId().isBlank() || properties.getSecretAccessKey().isBlank()) {
            throw new IllegalStateException("R2 requires R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
        }
        return S3Client.builder()
                .httpClientBuilder(UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(10))
                        .socketTimeout(Duration.ofSeconds(20)))
                .endpointOverride(URI.create("https://" + properties.getAccountId() + ".r2.cloudflarestorage.com"))
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(
                        properties.getAccessKeyId(), properties.getSecretAccessKey())))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true)
                        .chunkedEncodingEnabled(false).build())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .overrideConfiguration(config -> config.apiCallTimeout(Duration.ofSeconds(30))
                        .apiCallAttemptTimeout(Duration.ofSeconds(10)))
                .build();
    }
}
