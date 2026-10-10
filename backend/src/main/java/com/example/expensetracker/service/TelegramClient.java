package com.example.expensetracker.service;

import java.util.List;

public interface TelegramClient {
    record Chat(Long id, String type) {}
    record Sender(Long id) {}
    record Message(Chat chat, Sender from, String text) {}
    record Update(Long update_id, Message message) {}

    void send(long chatId, String message);
    List<Update> updates(long offset);
}
