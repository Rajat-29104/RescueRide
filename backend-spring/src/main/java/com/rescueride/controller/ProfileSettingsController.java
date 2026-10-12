package com.rescueride.controller;

import com.rescueride.security.AppPrincipal;
import com.rescueride.service.ProfileSettingsService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
public class ProfileSettingsController {
    private final ProfileSettingsService service;

    public ProfileSettingsController(ProfileSettingsService service) { this.service = service; }

    @GetMapping("/preferences")
    public Map<String, Object> preferences(@AuthenticationPrincipal AppPrincipal user) {
        return service.preferences(user);
    }

    @PutMapping("/preferences")
    public Map<String, Object> updatePreferences(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.updatePreferences(user, body);
    }

    @GetMapping("/change-requests")
    public Map<String, Object> changeRequests(@AuthenticationPrincipal AppPrincipal user) {
        return service.changeRequests(user);
    }

    @PostMapping("/change-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> requestProfileChange(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.requestProfileChange(user, body);
    }
}
