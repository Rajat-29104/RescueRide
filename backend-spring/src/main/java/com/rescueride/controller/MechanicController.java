package com.rescueride.controller;

import com.rescueride.security.AppPrincipal;
import com.rescueride.service.MechanicService;
import com.rescueride.service.RescueRequestService;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mechanics")
public class MechanicController {
    private final MechanicService mechanics;
    private final RescueRequestService requests;

    public MechanicController(MechanicService mechanics, RescueRequestService requests) {
        this.mechanics = mechanics;
        this.requests = requests;
    }

    @GetMapping("/profile")
    public Map<String, Object> profile(@AuthenticationPrincipal AppPrincipal user) {
        return mechanics.profile(user);
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return mechanics.updateProfile(user, body);
    }

    @GetMapping("/requests")
    public Map<String, Object> requests(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(defaultValue = "requests") String view) {
        return requests.mechanicRequests(user, view);
    }
}
