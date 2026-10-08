package com.example.expensetracker.service;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Category;
import com.example.expensetracker.mapper.CategoryMapper;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Gives a brand new account the starter category set so the UI is usable
 * immediately, whether the account was self-registered or created by a super
 * administrator. Extracted from {@code AuthService} because both paths need it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DefaultCategorySeeder {

    private static final List<CategoryTemplate> TEMPLATES = List.of(
            new CategoryTemplate("Groceries", "Supermarket and farmers market runs", "ShoppingCart", "#22c55e"),
            new CategoryTemplate("Transport", "Fuel, transit, rides and parking", "Car", "#3b82f6"),
            new CategoryTemplate("Dining", "Restaurants, coffee and takeout", "UtensilsCrossed", "#f59e0b"),
            new CategoryTemplate("Housing", "Rent, utilities and maintenance", "Home", "#8b5cf6"),
            new CategoryTemplate("Entertainment", "Streaming, events and hobbies", "Clapperboard", "#ec4899"),
            new CategoryTemplate("Health", "Pharmacy, gym and medical", "HeartPulse", "#ef4444"),
            new CategoryTemplate("Shopping", "Clothing, electronics and home goods", "ShoppingBag", "#14b8a6"),
            new CategoryTemplate("Other", "Everything that does not fit elsewhere", "Ellipsis", "#64748b"));

    private record CategoryTemplate(String name, String description, String iconName, String colorHex) {
    }

    private final CategoryMapper categoryMapper;

    /** Runs inside the caller's transaction, so a failure rolls the account back. */
    public void seed(UUID userId) {
        for (CategoryTemplate template : TEMPLATES) {
            categoryMapper.insert(Category.builder()
                    .name(template.name())
                    .description(template.description())
                    .iconName(template.iconName())
                    .colorHex(template.colorHex())
                    .userId(userId)
                    .build());
        }
        log.debug("Seeded {} default categories for user {}", TEMPLATES.size(), userId);
    }
}
