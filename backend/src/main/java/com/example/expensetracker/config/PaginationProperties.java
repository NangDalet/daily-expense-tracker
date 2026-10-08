package com.example.expensetracker.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Paging limits bound from {@code app.pagination.*}.
 * <p>
 * The bounds are enforced centrally by {@link #sanitize(Pageable)} so a client
 * cannot ask for 100 000 rows by passing {@code size=100000}.
 * <p>
 * Registered through {@code @ConfigurationPropertiesScan} on the application
 * class - it is intentionally <strong>not</strong> a {@code @Component} so the
 * bean is not defined twice.
 */
@ConfigurationProperties(prefix = "app.pagination")
public class PaginationProperties {

    private int defaultSize = 20;

    private int maxSize = 100;

    /**
     * Clamps the requested page/size into the configured window and guarantees
     * a non-null sort.
     */
    public Pageable sanitize(Pageable pageable) {
        int size = pageable == null ? defaultSize : pageable.getPageSize();
        int page = pageable == null ? 0 : pageable.getPageNumber();

        int safeSize = Math.min(Math.max(size, 1), maxSize);
        int safePage = Math.max(page, 0);
        Sort sort = pageable == null ? Sort.unsorted() : pageable.getSort();

        return PageRequest.of(safePage, safeSize, sort);
    }

    /** Whitelist of client sortable properties mapped to their SQL column. */
    private static final List<String> SORTABLE_PROPERTIES =
            List.of("expenseDate", "amount", "description", "paymentMethod", "currency",
                    "createdAt", "updatedAt", "category");

    /**
     * Extracts the first sort order and maps it to the identifiers understood by
     * the {@code <choose>} whitelist in the mapper XML. Unknown properties fall
     * back to {@code expenseDate}, which is what the index supports.
     */
    public static String toSortColumn(Sort sort) {
        if (sort == null || sort.isUnsorted()) {
            return "expenseDate";
        }
        Sort.Order order = sort.iterator().next();
        String property = order.getProperty();
        return SORTABLE_PROPERTIES.stream()
                .filter(candidate -> candidate.equalsIgnoreCase(property))
                .findFirst()
                .orElse("expenseDate");
    }

    /** {@code ASC}/{@code DESC}, uppercase - the exact tokens the XML compares against. */
    public static String toSortDirection(Sort sort) {
        if (sort == null || sort.isUnsorted()) {
            return "DESC";
        }
        Sort.Order order = sort.iterator().next();
        return Sort.Direction.ASC.equals(order.getDirection()) ? "ASC" : "DESC";
    }

    public int getDefaultSize() {
        return defaultSize;
    }

    public void setDefaultSize(int defaultSize) {
        this.defaultSize = defaultSize;
    }

    public int getMaxSize() {
        return maxSize;
    }

    public void setMaxSize(int maxSize) {
        this.maxSize = maxSize;
    }
}
