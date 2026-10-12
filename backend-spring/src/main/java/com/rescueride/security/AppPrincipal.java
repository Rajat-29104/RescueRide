package com.rescueride.security;

import java.util.UUID;

public record AppPrincipal(UUID id, String email, String role, boolean suspended, boolean active) {}
