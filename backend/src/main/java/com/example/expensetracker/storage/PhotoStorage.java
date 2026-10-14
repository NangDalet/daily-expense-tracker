package com.example.expensetracker.storage;

import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import java.util.Base64;
import java.util.UUID;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/** Stable app URLs reference private R2 objects; legacy embedded photos remain readable. */
@Service @Slf4j
public class PhotoStorage {
    public static final String URL_PREFIX = "/api/v1/media/";
    private final R2Properties properties;
    private final ObjectProvider<S3Client> clients;

    public PhotoStorage(R2Properties properties, ObjectProvider<S3Client> clients) {
        this.properties = properties;
        this.clients = clients;
    }

    /** Null preserves, blank removes, and an unchanged managed reference preserves. */
    public String replace(String incoming, String existing, String directory, UnaryOperator<String> normalize) {
        if (incoming == null) return existing;
        if (incoming.equals(existing) && (isManaged(incoming) || !properties.isEnabled())) return existing;
        String normalized = incoming.isBlank() ? null : normalize.apply(incoming);
        String replacement = null;
        String newKey = null;
        if (normalized != null) {
            // Never fall back to putting image bytes in PostgreSQL.
            if (!properties.isEnabled()) throw unavailable();
            if (!TransactionSynchronizationManager.isActualTransactionActive()) {
                throw new IllegalStateException("R2 photo uploads require a database transaction");
            }
            newKey = directory + "/" + UUID.randomUUID() + ".jpg";
            // Register before the network call: even a timed-out PUT may have created its object.
            scheduleCleanup(newKey, existing);
            byte[] bytes = Base64.getDecoder().decode(normalized.substring(normalized.indexOf(',') + 1));
            try {
                client().putObject(PutObjectRequest.builder().bucket(properties.getBucket()).key(newKey)
                        .contentType("image/jpeg").contentLength((long) bytes.length).build(), RequestBody.fromBytes(bytes));
            } catch (SdkException e) {
                log.warn("R2 photo upload failed: {}", errorSummary(e));
                throw unavailable();
            }
            replacement = URL_PREFIX + newKey;
        }
        if (properties.isEnabled() && newKey == null && isManaged(existing)) {
            scheduleCleanup(newKey, existing);
        }
        return replacement;
    }

    public byte[] read(String reference) {
        if (!isManaged(reference)) throw missing();
        try {
            return client().getObjectAsBytes(GetObjectRequest.builder().bucket(properties.getBucket())
                    .key(reference.substring(URL_PREFIX.length())).build()).asByteArray();
        } catch (NoSuchKeyException e) {
            throw missing();
        } catch (SdkException e) {
            log.warn("R2 photo read failed: {}", errorSummary(e));
            throw unavailable();
        }
    }

    private S3Client client() {
        S3Client client = clients.getIfAvailable();
        if (!properties.isEnabled() || client == null) throw unavailable();
        return client;
    }

    private void scheduleCleanup(String newKey, String existing) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                // Never remove the old image until its database replacement commits.
                if (status == STATUS_COMMITTED && isManaged(existing)) delete(existing.substring(URL_PREFIX.length()));
                else if (status == STATUS_ROLLED_BACK && newKey != null) delete(newKey);
            }
        });
    }

    private void delete(String key) {
        try {
            client().deleteObject(DeleteObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
        } catch (SdkException | ApiException e) {
            log.warn("Could not clean up R2 photo {}; retry cleanup for unreferenced objects", key);
        }
    }

    public static boolean isManaged(String value) {
        return value != null && value.matches("/api/v1/media/(profiles/[a-f0-9-]{36}|workers/[a-f0-9-]{36}/(photos|id-cards))/[a-f0-9-]{36}\\.jpg");
    }
    private static String errorSummary(SdkException exception) {
        if (exception instanceof S3Exception s3) {
            return "HTTP " + s3.statusCode() + " / " + (s3.awsErrorDetails() == null ? "unknown" : s3.awsErrorDetails().errorCode());
        }
        Throwable cause = exception;
        while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
        return exception.getClass().getSimpleName() + " / " + cause.getClass().getSimpleName();
    }
    private static ApiException missing() { return new ApiException(ErrorCode.NOT_FOUND, "Photo not found"); }
    private static ApiException unavailable() {
        return new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Photo storage is unavailable. Please try again later.");
    }
}
