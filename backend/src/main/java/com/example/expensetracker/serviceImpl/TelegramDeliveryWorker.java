package com.example.expensetracker.serviceImpl;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.mapper.TelegramMapper;
import com.example.expensetracker.service.TelegramClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
@Component @RequiredArgsConstructor @Slf4j
public class TelegramDeliveryWorker {
    private final TelegramMapper mapper;
    private final TelegramClient client;
    private final TelegramProperties properties;
    private final TransactionTemplate transactions;
    @Scheduled(fixedDelayString="${app.telegram.delivery-delay-ms:1200}")
    public void deliver() {
        if (!properties.isConfigured()) return;
        var item = transactions.execute(status -> mapper.claim());
        if (item == null) return;
        var connection = mapper.find(item.getUserId());
        if (connection == null || !Boolean.TRUE.equals(connection.getEnabled()) || !item.getChatId().equals(connection.getChatId())) {
            transactions.executeWithoutResult(status -> mapper.sent(item.getId())); return;
        }
        try {
            client.send(item.getChatId(), item.getMessage());
            transactions.executeWithoutResult(status -> mapper.sent(item.getId()));
        } catch (RuntimeException ex) {
            // Exception messages may include the bot token in a request URL. Never log them.
            log.warn("Telegram delivery {} failed on attempt {}", item.getId(), item.getAttempts());
            transactions.executeWithoutResult(status -> mapper.retry(item.getId()));
        }
    }
}
