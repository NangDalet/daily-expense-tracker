package com.example.expensetracker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Create / update payload for a category. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "CategoryRequest", description = "Category create/update payload")
public class CategoryRequest {

    @NotBlank(message = "name is required")
    @Size(min = 1, max = 80, message = "name must be between 1 and 80 characters")
    @Schema(example = "Groceries", requiredMode = Schema.RequiredMode.REQUIRED)
    private String name;

    @Size(max = 255, message = "description must not exceed 255 characters")
    @Schema(example = "Supermarket and farmers market runs")
    private String description;

    @Size(max = 50, message = "iconName must not exceed 50 characters")
    @Builder.Default
    @Schema(example = "ShoppingCart")
    private String iconName = "Tag";

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "colorHex must be a hex colour such as #22c55e")
    @Builder.Default
    @Schema(example = "#22c55e")
    private String colorHex = "#6366f1";
}
