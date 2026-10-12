package com.rescueride.controller;

import com.rescueride.security.AppPrincipal;
import com.rescueride.service.AdminService;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService service;

    public AdminController(AdminService service) { this.service = service; }

    @GetMapping("/stats")
    public Map<String, Object> stats(@AuthenticationPrincipal AppPrincipal user) { return service.stats(user); }

    @GetMapping("/requests")
    public Map<String, Object> requests(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean flagged,
            @RequestParam(defaultValue = "50") int limit, @RequestParam(defaultValue = "0") int offset) {
        return service.requests(user, status, flagged, limit, offset);
    }

    @GetMapping("/users")
    public Map<String, Object> users(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(required = false) String role, @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return service.users(user, role, limit, offset);
    }

    @DeleteMapping("/users")
    public Map<String, Object> suspendUser(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.suspendUser(user, body);
    }

    @GetMapping("/mechanics")
    public Map<String, Object> mechanics(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(required = false) String status) {
        return service.mechanics(user, status);
    }

    @PatchMapping("/mechanics")
    public Map<String, Object> verifyMechanic(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.verifyMechanic(user, body);
    }

    @GetMapping("/moderation")
    public Map<String, Object> moderation(@AuthenticationPrincipal AppPrincipal user) {
        return service.moderation(user);
    }

    @PatchMapping("/incidents")
    public Map<String, Object> updateIncident(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.updateIncident(user, body);
    }
}
