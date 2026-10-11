package com.example.expensetracker.construction;

import static org.assertj.core.api.Assertions.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import javax.imageio.ImageIO;
import com.example.expensetracker.exception.ApiException;
import org.junit.jupiter.api.Test;

class WorkerPhotoTest {
    private String png(int width, int height) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB), "png", bytes);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
    @Test void normalizesPngAndJpegToReadableJpeg() throws Exception {
        String normalized = WorkerPhoto.normalize(png(384, 256));
        assertThat(normalized).startsWith("data:image/jpeg;base64,");
        var image = ImageIO.read(new ByteArrayInputStream(Base64.getDecoder().decode(normalized.split(",", 2)[1])));
        assertThat(image.getWidth()).isEqualTo(384);
        assertThat(image.getHeight()).isEqualTo(256);
        assertThat(image.getRGB(0,0) & 0xffffff).isEqualTo(0xffffff);
        assertThat(WorkerPhoto.normalize(normalized)).startsWith("data:image/jpeg;base64,");
    }
    @Test void rejectsOversizedDimensionsBeforeDecodingPixels() throws Exception {
        String photo = png(513, 1);
        assertThatThrownBy(() -> WorkerPhoto.normalize(photo)).isInstanceOf(ApiException.class);
    }
    @Test void rejectsInvalidContentTypesBase64AndExcessivePayloads() {
        for (String input : new String[] { "https://example.com/photo.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,invalid!", "data:image/jpeg;base64,aGVsbG8=", "data:image/png;base64," + "A".repeat(350000) }) {
            assertThatThrownBy(() -> WorkerPhoto.normalize(input)).isInstanceOf(ApiException.class);
        }
    }
    @Test void acceptsMissingAndRemovedPhotos() {
        assertThat(WorkerPhoto.normalize(null)).isNull();
        assertThat(WorkerPhoto.normalize("")).isNull();
    }
    @Test void idCardsKeepReadableResolutionAndRejectInvalidContent() throws Exception {
        String card = WorkerPhoto.normalizeIdCard(png(1600, 1000));
        var image = ImageIO.read(new ByteArrayInputStream(Base64.getDecoder().decode(card.split(",", 2)[1])));
        assertThat(image.getWidth()).isEqualTo(1600);
        assertThat(image.getHeight()).isEqualTo(1000);
        assertThatThrownBy(() -> WorkerPhoto.normalizeIdCard(png(1601, 1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> WorkerPhoto.normalizeIdCard("data:image/jpeg;base64,aGVsbG8=")).hasMessageContaining("Invalid ID card");
        assertThat(WorkerPhoto.normalizeIdCard(null)).isNull();
        assertThat(WorkerPhoto.normalizeIdCard("")).isNull();
    }
}
