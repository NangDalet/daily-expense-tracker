package com.example.expensetracker.telegram.model;
import lombok.Data;
@Data
public class TelegramNotification {
    private java.util.UUID id;
    private java.util.UUID userId;
    private Long chatId;
    private String message;
    private Integer attempts;
}
