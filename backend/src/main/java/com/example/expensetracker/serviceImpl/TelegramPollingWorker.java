package com.example.expensetracker.serviceImpl;

import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.service.TelegramClient;
import com.example.expensetracker.service.TelegramService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TelegramPollingWorker {
    private final TelegramClient client;
    private final TelegramService service;
    private final TelegramProperties properties;
    private long offset;

    @Scheduled(fixedDelayString = "${app.telegram.poll-delay-ms:3000}")
    public synchronized void poll() {
        if (!properties.isConfigured() || !"polling".equals(properties.getUpdatesMode())) return;
        try {
            for (var update : client.updates(offset)) {
                if (update.update_id() == null) continue;
                var message = update.message();
                service.accept(properties.getWebhookSecret(), update.update_id(),
                        message != null && message.chat() != null ? message.chat().id() : null,
                        message != null && message.from() != null ? message.from().id() : null,
                        message != null && message.chat() != null ? message.chat().type() : null,
                        message != null ? message.text() : null);
                offset = update.update_id() + 1;
            }
        } catch (RuntimeException exception) {
            // Exception URLs may contain the bot token; do not log exception details.
            log.warn("Telegram polling failed; retrying. Check connectivity and ensure no webhook or other poller is active.");
        }
    }
}
