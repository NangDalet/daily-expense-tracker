package com.example.expensetracker.construction.service;

import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import javax.imageio.ImageIO;

/** Bounded, decoded and re-encoded photos, with no original metadata. */
final class WorkerPhoto {
    private WorkerPhoto() {}
    static String normalize(String value) {
        return normalize(value, 512, 350000, 250000, "Invalid worker photo. Choose a JPG, PNG or WebP image up to 5 MB.");
    }
    static String normalizeIdCard(String value) {
        return normalize(value, 1600, 2000000, 1500000, "Invalid ID card image. Choose a JPG, PNG or WebP image up to 5 MB.");
    }
    private static String normalize(String value, int maxDimension, int maxLength, int maxBytes, String error) {
        if (value == null || value.isBlank()) return null;
        try {
            if (value.length() > maxLength || !(value.startsWith("data:image/jpeg;base64,") || value.startsWith("data:image/png;base64,"))) throw new IllegalArgumentException();
            byte[] bytes = Base64.getDecoder().decode(value.substring(value.indexOf(',') + 1));
            if (bytes.length > maxBytes) throw new IllegalArgumentException();
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new IllegalArgumentException();
                var reader = readers.next();
                try {
                    reader.setInput(input);
                    String format = reader.getFormatName();
                    if (!(format.equalsIgnoreCase("JPEG") || format.equalsIgnoreCase("PNG"))) throw new IllegalArgumentException();
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) throw new IllegalArgumentException();
                    BufferedImage image = reader.read(0);
                    BufferedImage rgb = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
                    var graphics = rgb.createGraphics();
                    try { graphics.setColor(Color.WHITE); graphics.fillRect(0, 0, width, height); graphics.drawImage(image, 0, 0, null); }
                    finally { graphics.dispose(); }
                    var output = new ByteArrayOutputStream();
                    if (!ImageIO.write(rgb, "jpg", output) || output.size() > maxBytes) throw new IllegalArgumentException();
                    return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
                } finally { reader.dispose(); }
            }
        } catch (Exception e) {
            throw new ApiException(ErrorCode.BUSINESS_RULE_VIOLATION, error);
        }
    }
}
