package com.example.expensetracker;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Application entry point.
 * <p>
 * {@link MapperScan} registers every MyBatis mapper interface of the
 * {@code <domain>.mapper} packages; all of their SQL lives in
 * {@code classpath:mappers/*.xml}.
 */
@EnableScheduling
@SpringBootApplication
@ConfigurationPropertiesScan
@MapperScan({
        "com.example.expensetracker.budget.mapper",
        "com.example.expensetracker.category.mapper",
        "com.example.expensetracker.construction.mapper",
        "com.example.expensetracker.expense.mapper",
        "com.example.expensetracker.income.mapper",
        "com.example.expensetracker.reporting.mapper",
        "com.example.expensetracker.telegram.mapper",
        "com.example.expensetracker.user.mapper",
        "com.example.expensetracker.wallet.mapper"
})
public class ExpenseTrackerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExpenseTrackerApplication.class, args);
    }
}
