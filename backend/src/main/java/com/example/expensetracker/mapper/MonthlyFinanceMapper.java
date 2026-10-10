package com.example.expensetracker.mapper;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.dto.response.MonthlyFinanceResponse;
import org.apache.ibatis.annotations.Param;

public interface MonthlyFinanceMapper {
    List<MonthlyFinanceResponse> summary(@Param("userId") UUID userId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}
