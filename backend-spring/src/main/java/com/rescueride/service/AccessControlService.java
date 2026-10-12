package com.rescueride.service;

import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import org.springframework.stereotype.Service;

@Service
public class AccessControlService {
    public void requireRole(AppPrincipal user, String... allowedRoles) {
        for (String role : allowedRoles) {
            if (role.equals(user.role())) return;
        }
        throw ApiException.forbidden("Forbidden: insufficient permissions.");
    }
}
