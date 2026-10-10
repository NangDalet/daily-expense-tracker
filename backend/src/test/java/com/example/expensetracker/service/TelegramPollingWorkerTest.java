package com.example.expensetracker.service;

import static org.mockito.Mockito.*;
import java.util.List;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.serviceImpl.TelegramPollingWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TelegramPollingWorkerTest {
    TelegramClient client;
    TelegramService service;
    TelegramProperties properties;
    TelegramPollingWorker worker;
    @BeforeEach void setUp() {
        client = mock(TelegramClient.class);
        service = mock(TelegramService.class);
        properties = new TelegramProperties();
        properties.setEnabled(true);
        properties.setBotToken("test-token");
        properties.setBotUsername("test_bot");
        properties.setWebhookSecret("test-webhook-secret-12345");
        properties.setUpdatesMode("polling");
        worker = new TelegramPollingWorker(client, service, properties);
    }
    TelegramClient.Update update(long id) {
        return new TelegramClient.Update(id, new TelegramClient.Message(
                new TelegramClient.Chat(123L, "private"), new TelegramClient.Sender(123L), "/start link"));
    }
    @Test void forwardsPrivateMessageAndAcknowledgesAfterProcessing() {
        when(client.updates(0)).thenReturn(List.of(update(42)));
        when(client.updates(43)).thenReturn(List.of());
        worker.poll(); worker.poll();
        verify(service).accept(properties.getWebhookSecret(), 42L, 123L, 123L, "private", "/start link");
        verify(client).updates(43);
    }
    @Test void failedProcessingDoesNotAcknowledgeTheUpdate() {
        when(client.updates(0)).thenReturn(List.of(update(42)));
        doThrow(new IllegalStateException("temporary failure")).when(service)
                .accept(anyString(), anyLong(), anyLong(), anyLong(), anyString(), anyString());
        worker.poll(); worker.poll();
        verify(client, times(2)).updates(0);
    }
    @Test void webhookModeOrDisabledBotDoesNotPoll() {
        properties.setUpdatesMode("webhook"); worker.poll();
        properties.setUpdatesMode("polling"); properties.setEnabled(false); worker.poll();
        verifyNoInteractions(client, service);
    }
    @Test void nonMessageUpdatesAreProcessedWithoutNullPointerFailure() {
        when(client.updates(0)).thenReturn(List.of(new TelegramClient.Update(10L, null)));
        when(client.updates(11)).thenReturn(List.of());
        worker.poll(); worker.poll();
        verify(service).accept(properties.getWebhookSecret(), 10L, null, null, null, null);
        verify(client).updates(11);
    }
}
