package com.example.expensetracker.service;
import java.util.UUID;
public interface TelegramService {
    record Status(boolean available, boolean connected) {}
    record Link(String url, int expiresInSeconds) {}
    Status status(UUID userId);
    Link link(UUID userId);
    void disconnect(UUID userId);
    void accept(String secret, Long updateId, Long chatId, Long senderId, String type, String text);
}
