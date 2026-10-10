package com.example.expensetracker.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.UUID;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.domain.TelegramConnection;
import com.example.expensetracker.domain.TelegramNotification;
import com.example.expensetracker.mapper.TelegramMapper;
import com.example.expensetracker.serviceImpl.TelegramDeliveryWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

class TelegramDeliveryWorkerTest {
    TelegramMapper mapper;
    TelegramClient client;
    TelegramProperties properties;
    TelegramDeliveryWorker worker;
    TelegramNotification item;
    @BeforeEach void setUp() {
        mapper=mock(TelegramMapper.class); client=mock(TelegramClient.class);
        properties=new TelegramProperties(); properties.setEnabled(true);
        properties.setBotToken("test-token"); properties.setBotUsername("test_bot");
        properties.setWebhookSecret("test-webhook-secret-12345");
        var manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        worker=new TelegramDeliveryWorker(mapper,client,properties,new TransactionTemplate(manager));
        item=new TelegramNotification(); item.setId(UUID.randomUUID()); item.setUserId(UUID.randomUUID());
        item.setChatId(424242L); item.setAttempts(1); item.setMessage("Spending recorded");
    }
    void pending() {
        when(mapper.claim()).thenReturn(item);
        var connection=new TelegramConnection(); connection.setChatId(item.getChatId()); connection.setEnabled(true);
        when(mapper.find(item.getUserId())).thenReturn(connection);
    }
    @Test void successMarksOnlyAcceptedDeliverySent() {
        pending(); worker.deliver();
        verify(client).send(424242L,"Spending recorded"); verify(mapper).sent(item.getId()); verify(mapper,never()).retry(any());
    }
    @Test void anOutageSchedulesARetryWithoutMarkingSent() {
        pending(); doThrow(new IllegalStateException("test failure")).when(client).send(anyLong(),anyString());
        worker.deliver(); verify(mapper).retry(item.getId()); verify(mapper,never()).sent(any());
    }
    @Test void noCredentialsNeverCallsTelegramOrDatabase() {
        properties.setEnabled(false); worker.deliver(); verifyNoInteractions(mapper,client);
    }
    @Test void aDisconnectedChatDoesNotReceiveAnOldMessage() {
        when(mapper.claim()).thenReturn(item); when(mapper.find(item.getUserId())).thenReturn(null);
        worker.deliver(); verifyNoInteractions(client); verify(mapper).sent(item.getId());
    }
}
