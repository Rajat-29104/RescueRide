package com.rescueride.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "profiles", schema = "public")
public class ProfileEntity {
    @Id
    private UUID id;

    @Column(name = "role", insertable = false, updatable = false)
    private String role;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "is_active")
    private Boolean active;

    protected ProfileEntity() {}

    public UUID getId() { return id; }
    public String getRole() { return role; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public Boolean getActive() { return active; }
}
