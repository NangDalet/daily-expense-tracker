package com.example.expensetracker.storage;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class PhotoStorageTest {
    private final S3Client client = mock(S3Client.class);
    private final R2Properties properties = new R2Properties();
    private PhotoStorage storage;
    private static final String DIRECTORY = "profiles/11111111-1111-1111-1111-111111111111";
    private static final String OLD = PhotoStorage.URL_PREFIX + DIRECTORY + "/22222222-2222-2222-2222-222222222222.jpg";
    private static final byte[] JPEG = new byte[]{(byte) 0xff, (byte) 0xd8, 1, 2};
    private static final String DATA = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(JPEG);

    @BeforeEach void setup() {
        properties.setEnabled(true); properties.setBucket("private-photos");
        @SuppressWarnings("unchecked") ObjectProvider<S3Client> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(client);
        storage = new PhotoStorage(properties, provider);
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }
    @AfterEach void cleanup() {
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }
    private void complete(int status) {
        TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(status));
    }

    @Test void storesBinaryJpegWithUniqueKeyAndReturnsOnlyAnAppUrl() throws Exception {
        String reference = storage.replace("incoming", null, DIRECTORY, value -> DATA);
        assertThat(PhotoStorage.isManaged(reference)).isTrue();
        assertThat(reference).startsWith(PhotoStorage.URL_PREFIX + DIRECTORY + "/");
        var request = ArgumentCaptor.forClass(PutObjectRequest.class);
        var body = ArgumentCaptor.forClass(RequestBody.class);
        verify(client).putObject(request.capture(), body.capture());
        assertThat(request.getValue().bucket()).isEqualTo("private-photos");
        assertThat(request.getValue().contentType()).isEqualTo("image/jpeg");
        try (var stream = body.getValue().contentStreamProvider().newStream()) {
            assertThat(stream.readAllBytes()).isEqualTo(JPEG);
        }
    }

    @Test void rollbackDeletesNewObjectAndPreservesOldObject() {
        String replacement = storage.replace(DATA, OLD, DIRECTORY, value -> DATA);
        verify(client, never()).deleteObject(any(DeleteObjectRequest.class));
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        var deletion = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(deletion.capture());
        assertThat(deletion.getValue().key()).isEqualTo(replacement.substring(PhotoStorage.URL_PREFIX.length()));
    }

    @Test void commitDeletesOldObjectAfterReplacementIsSaved() {
        storage.replace(DATA, OLD, DIRECTORY, value -> DATA);
        verify(client, never()).deleteObject(any(DeleteObjectRequest.class));
        complete(TransactionSynchronization.STATUS_COMMITTED);
        var deletion = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(deletion.capture());
        assertThat(deletion.getValue().key()).isEqualTo(OLD.substring(PhotoStorage.URL_PREFIX.length()));
    }

    @Test void nullAndUnchangedReferencesPreserveAndBlankRemoves() {
        assertThat(storage.replace(null, OLD, DIRECTORY, value -> { throw new AssertionError(); })).isEqualTo(OLD);
        assertThat(storage.replace(OLD, OLD, DIRECTORY, value -> { throw new AssertionError(); })).isEqualTo(OLD);
        assertThat(storage.replace("", OLD, DIRECTORY, value -> { throw new AssertionError(); })).isNull();
        verifyNoInteractions(client);
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(client).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test void disabledR2RejectsUploadsInsteadOfReturningDatabaseImageData() {
        properties.setEnabled(false);
        assertThatThrownBy(() -> storage.replace("incoming", null, DIRECTORY, value -> DATA))
                .hasMessage("Photo storage is unavailable. Please try again later.");
        assertThat(storage.replace(DATA, DATA, DIRECTORY, value -> { throw new AssertionError(); })).isEqualTo(DATA);
        assertThatThrownBy(() -> storage.replace("bad", null, DIRECTORY, value -> { throw new IllegalArgumentException("Invalid image"); }))
                .hasMessage("Invalid image");
        verifyNoInteractions(client);
    }

    @Test void storageFailureDoesNotReturnANewDatabaseReferenceOrDeleteTheOldImage() {
        when(client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(SdkClientException.create("Credentials or endpoint failed"));
        assertThatThrownBy(() -> storage.replace(DATA, OLD, DIRECTORY, value -> DATA))
                .hasMessage("Photo storage is unavailable. Please try again later.");
        verify(client, never()).deleteObject(any(DeleteObjectRequest.class));
    }
}
