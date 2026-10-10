package com.example.expensetracker.service;

import static org.assertj.core.api.Assertions.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;
import javax.imageio.ImageIO;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.serviceImpl.ProfilePhotoProcessor;
import org.junit.jupiter.api.Test;

class ProfilePhotoProcessorTest {
    final ProfilePhotoProcessor photos = new ProfilePhotoProcessor();
    String png(int width, int height) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB), "png", output);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
    }
    @Test void cropsResizesAndReencodesPhotosAsJpeg() throws Exception {
        String normalized = photos.normalize(png(600, 300));
        assertThat(normalized).startsWith("data:image/jpeg;base64,");
        var image = ImageIO.read(new ByteArrayInputStream(Base64.getDecoder().decode(normalized.split(",", 2)[1])));
        assertThat(image.getWidth()).isEqualTo(256);
        assertThat(image.getHeight()).isEqualTo(256);
    }
    @Test void rejectsMalformedContentUnsupportedTypesAndSpoofedMime() throws Exception {
        for (String invalid : new String[]{"data:image/svg+xml;base64,PHN2Zz4=", "data:image/jpeg;base64,invalid!", "data:image/png;base64,SGVsbG8=", "https://example.com/photo.png", png(4, 4).replace("image/png", "image/jpeg")})
            assertThatThrownBy(() -> photos.normalize(invalid)).isInstanceOf(ApiException.class);
    }
    @Test void rejectsExcessiveDimensionsBeforeDecodingPixels() throws Exception {
        String large = png(2049, 1);
        assertThatThrownBy(() -> photos.normalize(large)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> photos.normalize("data:image/png;base64," + "A".repeat(350_001))).isInstanceOf(ApiException.class);
    }
}
