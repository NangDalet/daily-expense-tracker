package com.example.expensetracker.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Spending category, always owned by exactly one user. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Category {

    private UUID id;

    private String name;

    private String description;

    /** Name of the lucide-react icon rendered by the frontend. */
    private String iconName;

    /** CSS colour used for the category badge, e.g. {@code #22c55e}. */
    private String colorHex;

    private UUID userId;

    /**
     * Denormalised counter, only populated by
     * {@code CategoryMapper#findAllByUserIdWithExpenseCount}. {@code null} for
     * plain CRUD reads.
     */
    private Long expenseCount;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
