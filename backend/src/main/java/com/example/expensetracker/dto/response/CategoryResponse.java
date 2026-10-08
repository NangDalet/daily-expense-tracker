package com.example.expensetracker.dto.response;

import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A spending category owned by the current user. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "CategoryResponse", description = "Spending category")
public class CategoryResponse {

    private String id;

    private String name;

    private String description;

    @Schema(description = "lucide-react icon name", example = "ShoppingCart")
    private String iconName;

    @Schema(description = "Badge colour as a hex string", example = "#22c55e")
    private String colorHex;

    private String userId;

    @Schema(description = "Number of expenses currently assigned to this category")
    private Long expenseCount;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
