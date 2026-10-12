package com.rescueride.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SupabaseAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger logger = LoggerFactory.getLogger(SupabaseAuthenticationFilter.class);
    private final RescueRideProperties properties;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public SupabaseAuthenticationFilter(RescueRideProperties properties, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.properties = properties;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return request.getMethod().equalsIgnoreCase("OPTIONS")
                || path.equals("/actuator/health")
                || path.equals("/actuator/info")
                || path.startsWith("/error");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = bearerToken(request);
        if (token == null) {
            unauthorized(response);
            return;
        }

        try {
            String userId = validateWithSupabase(token);
            AppPrincipal principal = jdbc.query(
                    """
                    select id, email, role::text as role, coalesce(is_suspended, false) as is_suspended,
                           coalesce(is_active, false) as is_active
                    from public.profiles where id = ?
                    """,
                    rs -> rs.next()
                            ? new AppPrincipal(
                                    rs.getObject("id", UUID.class),
                                    rs.getString("email"),
                                    rs.getString("role"),
                                    rs.getBoolean("is_suspended"),
                                    rs.getBoolean("is_active"))
                            : null,
                    UUID.fromString(userId));
            if (principal == null || principal.suspended() || !principal.active()) {
                unauthorized(response);
                return;
            }

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().toUpperCase()));
            var authentication = new UsernamePasswordAuthenticationToken(principal, token, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            chain.doFilter(request, response);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logger.warn("Supabase authentication request was interrupted.");
            unavailable(response);
        } catch (SecurityException | IllegalArgumentException exception) {
            unauthorized(response);
        } catch (IOException | DataAccessException | IllegalStateException exception) {
            logger.error("Authentication dependency is unavailable: {}", exception.getClass().getSimpleName());
            unavailable(response);
        } catch (Exception exception) {
            logger.error("Unexpected authentication failure: {}", exception.getClass().getSimpleName());
            unavailable(response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private String validateWithSupabase(String token) throws IOException, InterruptedException {
        String url = properties.supabase().url();
        String key = properties.supabase().anonKey();
        if (url == null || url.isBlank() || key == null || key.isBlank()) {
            throw new IllegalStateException("Supabase Auth is not configured.");
        }

        HttpRequest authRequest = HttpRequest.newBuilder()
                .uri(URI.create(url.replaceAll("/+$", "") + "/auth/v1/user"))
                .timeout(Duration.ofSeconds(8))
                .header("apikey", key)
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        HttpResponse<String> authResponse = httpClient.send(authRequest, HttpResponse.BodyHandlers.ofString());
        if (authResponse.statusCode() == 401 || authResponse.statusCode() == 403) {
            throw new SecurityException("Supabase rejected the access token.");
        }
        if (authResponse.statusCode() != 200) throw new IOException("Supabase Auth returned a service error.");
        JsonNode user = mapper.readTree(authResponse.body());
        String id = user.path("id").asText();
        UUID.fromString(id);
        return id;
    }

    private String bearerToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorization.substring(7).trim();
        }

        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        List<Cookie> authCookies = new ArrayList<>();
        for (Cookie cookie : cookies) {
            if (cookie.getName().matches("sb-.+-auth-token(?:\\.\\d+)?")) {
                authCookies.add(cookie);
            }
        }
        if (authCookies.isEmpty()) return null;
        authCookies.sort(Comparator.comparingInt(cookie -> cookie.getName().endsWith("-auth-token")
                ? -1
                : Integer.parseInt(cookie.getName().substring(cookie.getName().lastIndexOf('.') + 1))));

        String value = authCookies.stream().map(Cookie::getValue).reduce("", String::concat);
        try {
            if (value.startsWith("base64-")) {
                value = new String(java.util.Base64.getUrlDecoder().decode(value.substring(7)), StandardCharsets.UTF_8);
            }
            JsonNode session = mapper.readTree(value);
            if (session.isArray() && !session.isEmpty()) return session.get(0).asText(null);
            return session.path("access_token").asText(null);
        } catch (Exception exception) {
            return null;
        }
    }

    private void unauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Unauthorized\"}");
    }

    private void unavailable(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Authentication service is temporarily unavailable.\"}");
    }
}
