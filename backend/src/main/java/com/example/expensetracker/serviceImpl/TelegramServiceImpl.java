package com.example.expensetracker.serviceImpl;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.mapper.TelegramMapper;
import com.example.expensetracker.service.TelegramService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
@Service @RequiredArgsConstructor
public class TelegramServiceImpl implements TelegramService {
    private final TelegramMapper mapper;
    private final TelegramProperties properties;
    private static final SecureRandom RANDOM = new SecureRandom();
    @Override @Transactional(readOnly = true)
    public Status status(UUID userId) {
        var connection = mapper.find(userId);
        return new Status(properties.isConfigured(), connection != null && connection.getChatId() != null
                && Boolean.TRUE.equals(connection.getEnabled()));
    }
    @Override @Transactional
    public Link link(UUID userId) {
        if (!properties.isConfigured()) throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Telegram is not configured by the administrator");
        byte[] random = new byte[32]; RANDOM.nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        mapper.lockUser(userId);
        mapper.setLink(userId, hash(token));
        return new Link("https://t.me/" + properties.getBotUsername() + "?start=" + token, 600);
    }
    @Override @Transactional
    public void disconnect(UUID userId) {
        mapper.lockUser(userId);
        mapper.disconnect(userId);
        mapper.clearPending(userId);
    }
    @Override @Transactional
    public void accept(String secret, Long updateId, Long chatId, Long senderId, String type, String text) {
        if (!properties.isConfigured() || secret == null || !MessageDigest.isEqual(
                secret.getBytes(StandardCharsets.UTF_8), properties.getWebhookSecret().getBytes(StandardCharsets.UTF_8)))
            throw new ApiException(ErrorCode.FORBIDDEN, "Invalid Telegram webhook secret");
        if (chatId == null || chatId <= 0 || !chatId.equals(senderId) || !"private".equals(type)
                || text == null || !text.matches("/start [A-Za-z0-9_-]{43}")) return;
        var connection = mapper.connect(hash(text.substring(7)), chatId);
        if (connection != null) {
            mapper.clearPending(connection.getUserId());
            mapper.enqueue(connection.getUserId(), chatId, "linked:" + updateId + ":" + hash(text.substring(7)),
                    "Telegram connected. You will receive spending messages for your budgets and an alert at 80% usage.");
        }
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
