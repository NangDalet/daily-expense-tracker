package com.example.expensetracker.wallet.service;


import com.example.expensetracker.wallet.model.CashModels.*;
import com.example.expensetracker.expense.model.Expense;
import com.example.expensetracker.common.model.PaymentMethod;
import com.example.expensetracker.common.model.response.ApiResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.wallet.mapper.CashMapper;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Service
@RequiredArgsConstructor
public class CashService {
    private final CashMapper mapper;

    @Transactional(readOnly = true)
    public List<Balance> balances(UUID userId) { return mapper.balances(userId); }

    @Transactional(readOnly = true)
    public ApiResponse<List<Topup>> topups(UUID userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        int offset = (int) Math.min((long) safePage * safeSize, Integer.MAX_VALUE);
        return ApiResponse.ofPage(mapper.topups(userId, offset, safeSize), safePage, safeSize,
                mapper.countTopups(userId), "Top-ups retrieved");
    }

    @Transactional
    public Topup save(UUID userId, UUID id, TopupRequest request) {
        lock(userId);
        if (id != null) requireOwned(userId, id);
        Topup entry = new Topup();
        entry.setId(id == null ? UUID.randomUUID() : id);
        entry.setUserId(userId);
        entry.setAmount(request.getAmount());
        entry.setCurrency(request.getCurrency());
        entry.setTopupDate(request.getTopupDate());
        entry.setNote(request.getNote());
        if (id == null) mapper.insert(entry); else mapper.update(entry);
        requireAvailable(userId);
        return mapper.topup(userId, entry.getId());
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        lock(userId);
        requireOwned(userId, id);
        mapper.delete(userId, id);
        requireAvailable(userId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(UUID userId) {
        if (mapper.lockUser(userId) == null) throw ResourceNotFoundException.of("User", userId);
    }

    public void validateExpense(Expense expense) {
        if (expense.isUseTopupBalance() && expense.getPaymentMethod() != PaymentMethod.CASH) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Only cash expenses can use the top-up balance");
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAvailable(UUID userId) {
        for (Balance balance : mapper.balances(userId)) {
            if (balance.getRemainingAmount().signum() < 0) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Insufficient " + balance.getCurrency() + " top-up balance. Add a top-up or reduce the expense.");
            }
        }
    }

    private Topup requireOwned(UUID userId, UUID id) {
        Topup entry = mapper.topup(userId, id);
        if (entry == null) throw ResourceNotFoundException.of("Top-up", id);
        return entry;
    }
}
