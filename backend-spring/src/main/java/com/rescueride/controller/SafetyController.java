package com.rescueride.controller;

import com.rescueride.security.AppPrincipal;
import com.rescueride.service.SafetyService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SafetyController {
    private final SafetyService service;

    public SafetyController(SafetyService service) { this.service = service; }

    @GetMapping("/safety/emergency-contacts")
    public Map<String, Object> contacts(@AuthenticationPrincipal AppPrincipal user) { return service.listContacts(user); }

    @PostMapping("/safety/emergency-contacts")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addContact(@AuthenticationPrincipal AppPrincipal user, @RequestBody Map<String, Object> body) {
        return service.addContact(user, body);
    }

    @PostMapping("/safety/sos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> raiseSos(@AuthenticationPrincipal AppPrincipal user, @RequestBody Map<String, Object> body) {
        return service.raiseSos(user, body);
    }

    @GetMapping("/admin/incidents")
    public Map<String, Object> incidents(@AuthenticationPrincipal AppPrincipal user) {
        return Map.of("incidents", service.activeIncidents(user));
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> reportIncident(@AuthenticationPrincipal AppPrincipal user, @RequestBody Map<String, Object> body) {
        return service.reportIncident(user, body);
    }

    @GetMapping("/reports")
    public Map<String, Object> reports(@AuthenticationPrincipal AppPrincipal user) {
        return Map.of("reports", service.reports(user));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/reports")
    public Map<String, Object> deleteReports(@AuthenticationPrincipal AppPrincipal user,
            @RequestBody Map<String, Object> body) {
        return service.deleteReports(user, body);
    }
}
