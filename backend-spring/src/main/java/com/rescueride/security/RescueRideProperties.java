package com.rescueride.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rescueride")
public record RescueRideProperties(Supabase supabase, Cors cors, Webhook webhook) {
    public record Supabase(String url, String anonKey) {}
    public record Cors(List<String> allowedOrigins) {}
    public record Webhook(String secret) {}
}
