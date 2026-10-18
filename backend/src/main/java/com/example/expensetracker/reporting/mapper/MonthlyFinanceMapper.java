package com.example.expensetracker.reporting.mapper;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.reporting.model.response.MonthlyFinanceResponse;
import org.apache.ibatis.annotations.Param;

public interface MonthlyFinanceMapper {
    List<MonthlyFinanceResponse> summary(@Param("userId") UUID userId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}
