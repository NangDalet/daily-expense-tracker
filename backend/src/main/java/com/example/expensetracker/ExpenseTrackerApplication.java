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
 * {@code com.example.expensetracker.mapper} package; all of their SQL lives in
 * {@code classpath:mappers/*.xml}.
 */
@EnableScheduling
@SpringBootApplication
@ConfigurationPropertiesScan
@MapperScan("com.example.expensetracker.mapper")
public class ExpenseTrackerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExpenseTrackerApplication.class, args);
    }
}
