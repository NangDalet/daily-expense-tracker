package com.example.expensetracker.wallet.mapper;

import com.example.expensetracker.wallet.model.CashModels.*;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface CashMapper {
    UUID lockUser(UUID userId);
    List<Balance> balances(UUID userId);
    List<Topup> topups(@Param("userId") UUID userId, @Param("offset") int offset, @Param("limit") int limit);
    long countTopups(UUID userId);
    Topup topup(@Param("userId") UUID userId, @Param("id") UUID id);
    void insert(Topup topup);
    void update(Topup topup);
    void delete(@Param("userId") UUID userId, @Param("id") UUID id);
}
