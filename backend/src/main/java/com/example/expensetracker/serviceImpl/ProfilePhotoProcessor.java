package com.example.expensetracker.serviceImpl;

import java.awt.Color;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;
import javax.imageio.ImageIO;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import org.springframework.stereotype.Component;

@Component
public class ProfilePhotoProcessor {
    public String normalize(String dataUrl) {
        if (dataUrl == null || dataUrl.length() > 350_000
                || !(dataUrl.startsWith("data:image/jpeg;base64,") || dataUrl.startsWith("data:image/png;base64,")))
            throw invalid();
        try {
            byte[] bytes = Base64.getDecoder().decode(dataUrl.substring(dataUrl.indexOf(',') + 1));
            if (bytes.length == 0 || bytes.length > 262_144) throw invalid();
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid();
                var reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    String format = reader.getFormatName();
                    if (!(format.equalsIgnoreCase("JPEG") && dataUrl.startsWith("data:image/jpeg;"))
                            && !(format.equalsIgnoreCase("PNG") && dataUrl.startsWith("data:image/png;"))) throw invalid();
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > 2048 || height > 2048) throw invalid();
                    var original = reader.read(0);
                    var photo = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
                    var graphics = photo.createGraphics();
                    try {
                        graphics.setColor(Color.WHITE);
                        graphics.fillRect(0, 0, 256, 256);
                        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                        int side = Math.min(width, height), x = (width - side) / 2, y = (height - side) / 2;
                        graphics.drawImage(original, 0, 0, 256, 256, x, y, x + side, y + side, null);
                    } finally { graphics.dispose(); }
                    var output = new ByteArrayOutputStream();
                    if (!ImageIO.write(photo, "jpeg", output)) throw invalid();
                    return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
                } finally { reader.dispose(); }
            }
        } catch (IOException | IllegalArgumentException ex) { throw invalid(); }
    }
    private ApiException invalid() {
        return new ApiException(ErrorCode.VALIDATION_ERROR, "Choose a valid JPEG or PNG profile photo up to 256 KB and 2048 pixels. Crop larger photos in the app first.");
    }
}
