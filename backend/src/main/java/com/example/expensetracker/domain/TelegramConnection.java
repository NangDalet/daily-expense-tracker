package com.example.expensetracker.domain;
import lombok.Data;
@Data
public class TelegramConnection {
    private java.util.UUID userId;
    private Long chatId;
    private Boolean enabled;
}
