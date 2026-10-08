package com.example.expensetracker.config;

import java.util.List;

import javax.crypto.SecretKey;

import com.example.expensetracker.security.CorsProperties;
import com.example.expensetracker.security.JwtAuthenticationConverterImpl;
import com.example.expensetracker.security.JwtProperties;
import com.example.expensetracker.security.JsonAccessDeniedHandler;
import com.example.expensetracker.security.JsonAuthenticationEntryPoint;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Stateless OAuth2 Resource Server configuration.
 * <p>
 * Public endpoints: the {@code /api/v1/auth/**} family (register / login /
 * refresh), the OpenAPI documents and the actuator probes. Everything else
 * under {@code /api/v1} requires a valid bearer token, and the admin user
 * endpoints additionally require the {@code ADMIN} or {@code SUPER_ADMIN}
 * authority.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    /** Endpoints that must stay reachable without a token. */
    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/actuator/health/**",
            "/actuator/info",
            "/v3/api-docs",
            "/v3/api-docs/**",
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/error"
    };

    /**
     * User management. The finer-grained split - account creation and password
     * resets are super-administrator only, and an administrator may only manage
     * accounts below their own tier - is enforced by {@code @PreAuthorize} on
     * the methods and by the rank rules in {@code UserService}.
     */
    private static final String[] ADMIN_ENDPOINTS = {
            "/api/v1/users",
            "/api/v1/users/**"
    };

    private final JwtProperties jwtProperties;
    private final CorsProperties corsProperties;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;

    // ===================== Filter chain =====================

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless JWT API: no session, no CSRF token to manage
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(registry -> registry
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Declared here as well as on the controller so the
                        // requirement is visible next to the rest of the chain.
                        .requestMatchers(ADMIN_ENDPOINTS).hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt
                                .decoder(jwtDecoder())
                                .jwtAuthenticationConverter(new JwtAuthenticationConverterImpl()))
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(Customizer.withDefaults()))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);
        return http.build();
    }

    // ===================== Token decoding / encoding =====================

    /**
     * Single decoder that supports both deployment modes:
     * <ul>
     *   <li>external issuer configured -&gt; the JWK set of the provider is used
     *       and {@code iss}/{@code exp} are validated against it;</li>
     *   <li>otherwise the locally issued HS256 tokens are verified with the
     *       configured secret, the {@code iss} value and a clock skew.</li>
     * </ul>
     * Because the mode is decided at runtime (instead of with two conditional
     * beans) an empty {@code OAUTH_ISSUER_URI} can never be mistaken for a
     * configured issuer.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        if (jwtProperties.usesExternalIssuer()) {
            log.info("JWT validation delegated to the external issuer '{}'", jwtProperties.getIssuerUri());
            return JwtDecoders.fromIssuerLocation(jwtProperties.getIssuerUri());
        }
        SecretKey key = jwtProperties.secretKey();
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(jwtProperties.getClockSkew()),
                new JwtIssuerValidator(jwtProperties.getIssuer())));
        log.info("JWT validation using local HS256 issuer '{}'", jwtProperties.getIssuer());
        return decoder;
    }

    /** Encoder for the locally issued tokens; unused in external issuer mode. */
    @Bean
    public JwtEncoder jwtEncoder() {
        SecretKey key = jwtProperties.secretKey();
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ===================== CORS =====================

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        if (corsProperties.isAllowAllOrigins()) {
            // The browser forbids "*" together with credentials
            configuration.setAllowedOriginPatterns(List.of("*"));
        } else {
            configuration.setAllowedOrigins(corsProperties.getAllowedOrigins());
        }
        configuration.setAllowedMethods(corsProperties.getAllowedMethods());
        configuration.setAllowedHeaders(corsProperties.getAllowedHeaders());
        configuration.setExposedHeaders(corsProperties.getExposedHeaders());
        configuration.setAllowCredentials(corsProperties.isAllowCredentials());
        configuration.setMaxAge(corsProperties.getMaxAge());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
