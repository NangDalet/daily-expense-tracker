package com.example.expensetracker.telegram.model;
import lombok.Data;
@Data
public class TelegramConnection {
    private java.util.UUID userId;
    private Long chatId;
    private Boolean enabled;
}
